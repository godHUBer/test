// Phase 1 bridge: only trusted, versioned repository HTML may enter this adapter.
// Never use it to render user input or database HTML.
import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
const inventory = JSON.parse(await readFile('assets/data/inventory.json', 'utf8'));
const general = ['index', 'inventory', 'sell-your-car', 'about', 'showroom', 'contact', 'legal'];
const mapping = new Map(general.map(name => [`${name}.html`, name === 'index' ? '/' : `/${name}`]));
for (const car of inventory.cars) mapping.set(`car-${car.id}.html`, `/cars/${car.id}`);
const rewrite = html => html
  .replace(/\b(href|src|poster)="([^"#?]+)([^\"]*)"/g, (all, attr, path, suffix) => {
    const dest = mapping.get(path);
    if (dest) return `${attr}="${dest}${suffix}"`;
    if (path.startsWith('assets/')) return `${attr}="/${path}${suffix}"`;
    return all;
  })
  .replace(/\bsrcset="([^"]+)"/g, (_, value) => `srcset="${value.replace(/(^|,\s*)assets\//g, '$1/assets/')}"`);
const pages = {};
let navigation, footer;
for (const [source, route] of mapping) {
  const html = await readFile(source, 'utf8');
  const mainStart = html.indexOf('<main ');
  const mainEnd = html.indexOf('</main>') + '</main>'.length;
  const bodyStart = html.indexOf('>', html.indexOf('<body')) + 1;
  const footerStart = html.indexOf('<footer ');
  const footerEnd = html.indexOf('</footer>') + '</footer>'.length;
  const scriptStart = html.indexOf('<script', footerEnd);
  if (mainStart < 0 || mainEnd < 7 || footerStart < 0 || scriptStart < 0) throw new Error(`Invalid legacy page: ${source}`);
  if (route === '/') {
    navigation = rewrite(html.slice(bodyStart, mainStart)).replaceAll(' aria-current="page"', '');
    footer = rewrite(html.slice(footerStart, footerEnd));
  }
  const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  pages[route] = {
    title: decode(html.match(/<title>(.*?)<\/title>/s)?.[1] ?? ''),
    description: decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''),
    page: route === '/legal' ? 'legal' : (html.match(/<body[^>]*data-page="([^"]+)"/)?.[1] ?? ''),
    main: rewrite(html.slice(mainStart, mainEnd)),
    afterFooter: rewrite(html.slice(footerEnd, scriptStart)),
  };
  if (route === '/legal') {
    pages[route].main = pages[route].main
      .replace('This site sets no cookies and runs no analytics.', 'Public browsing runs no analytics or advertising cookies. When staff authentication is enabled, invited dealership staff sign-in uses essential, secure authentication cookies and Supabase processes staff account data. Public visitors do not need an account.')
      .replace('No account, no\n      storage, no tracking pixel, no newsletter signup.', 'No customer account, no enquiry storage, no tracking pixel, no newsletter signup.');
  }
  if (/<script\b|\bon\w+\s*=/i.test(pages[route].main)) throw new Error(`Unexpected active content in ${source}`);
}
await mkdir('.generated', { recursive: true });
await mkdir('public', { recursive: true });
await writeFile('.generated/site.json', JSON.stringify({ navigation, footer, pages }));
const editorial = {};
for (const [route, source] of Object.entries({ '/':'index', '/about':'about', '/showroom':'showroom', '/contact':'contact', '/sell-your-car':'sell', '/legal':'legal' })) {
  const sourceHtml = await readFile(`src/${source}.src.html`, 'utf8');
  let main = sourceHtml.slice(sourceHtml.indexOf('<main '), sourceHtml.indexOf('</main>')+7);
  main = rewrite(main)
    .replace('{{PUBLISHED}} of {{FLOOR}}', '{{PUBLISHED}} records')
    .replace('{{PUBLISHED}} cars are published here out of roughly {{FLOOR}} on the books.', 'contact the showroom to confirm current stock and a viewing time.')
    .replace('On the floor this week', 'From the dealership')
    .replace('What the forecourt looks like<br>right now.', 'Photographs from<br>the dealership listings.')
    .replace('are rebuilt from the same data.', 'use the same current public inventory records.')
    .replace('This site sets no cookies and runs no analytics.', 'Public browsing runs no analytics or advertising cookies. When staff authentication is enabled, invited staff use essential secure authentication cookies and Supabase processes staff account data.')
    .replace('No account, no\n      storage, no tracking pixel, no newsletter signup.', 'No customer account, no enquiry storage, no tracking pixel, no newsletter signup.');
  if (/<script\b|\bon\w+\s*=/i.test(main)) throw new Error(`Unexpected active template: ${source}`);
  editorial[route] = main;
}
await writeFile('.generated/editorial.json', JSON.stringify(editorial));
await cp('assets', 'public/assets', { recursive: true });
// Root-relative URLs are necessary on nested /cars/[slug] routes.
await writeFile('public/site.css', (await readFile('assets/css/styles.css', 'utf8')).replaceAll("url('assets/", "url('/assets/"));
const legacyScript = await readFile('assets/js/site.js', 'utf8');
if (!legacyScript.includes('initNav(); initSheet();')) throw new Error('Review changed legacy bootstrap');
// The app owns menu focus/lifecycle; avoid double listeners from the retained script.
await writeFile('public/site.js', legacyScript.replace('initNav(); initSheet();', 'initNav();').replace('initGallery(); initInventory();', ''));
const htmlFiles = (await readdir('.')).filter(p => p.endsWith('.html'));
if (htmlFiles.length !== mapping.size) throw new Error('Unmapped legacy HTML page');
console.log(`Prepared ${mapping.size} legacy regression captures, ${Object.keys(editorial).length} editorial templates and shared assets.`);
