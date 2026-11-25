// One-off migration: convert the legacy editorial HTML templates (src/*.src.html)
// into a committed TypeScript content module (lib/editorial/templates.ts), so the
// repository no longer ships any .html files. The transforms applied here are
// identical to those previously performed by scripts/prepare-site.mjs.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const mapping = new Map([
  ['index.html', '/'],
  ['inventory.html', '/inventory'],
  ['sell-your-car.html', '/sell-your-car'],
  ['about.html', '/about'],
  ['showroom.html', '/showroom'],
  ['contact.html', '/contact'],
  ['legal.html', '/legal'],
]);

const rewrite = (html) => html
  .replace(/\b(href|src|poster)="([^"#?]+)([^"]*)"/g, (all, attr, path, suffix) => {
    const dest = mapping.get(path);
    if (dest) return `${attr}="${dest}${suffix}"`;
    if (path.startsWith('assets/')) return `${attr}="/${path}${suffix}"`;
    return all;
  })
  .replace(/\bsrcset="([^"]+)"/g, (_, value) => `srcset="${value.replace(/(^|,\s*)assets\//g, '$1/assets/')}"`);

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
  if (/<script\b|\son\w+\s*=/i.test(main)) throw new Error(`Unexpected active template: ${source}`);
  editorial[route] = main;
}

const lines = Object.entries(editorial).map(([route, html]) => {
  // Escape backticks and ${ for a template-literal-safe TS string.
  const safe = html.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
  return `  ${JSON.stringify(route)}: \`${safe}\`,`;
});

const out = `// Auto-generated from the legacy editorial templates by scripts/build-editorial.mjs.
// Do not edit by hand; the content is the reviewed public copy. Internal links are
// already rewritten to Next.js routes and asset paths are root-relative.
export const editorialTemplates: Record<string, string> = {
${lines.join('\n')}
};
`;

await mkdir('lib/editorial', { recursive: true });
await writeFile('lib/editorial/templates.ts', out);
console.log(`Wrote lib/editorial/templates.ts with ${Object.keys(editorial).length} editorial templates.`);
