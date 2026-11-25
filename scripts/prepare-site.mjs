// Build-time asset preparation for the Next.js static export.
//
// The editorial content is committed as lib/editorial/templates.ts (no .html
// files ship in the repository). This script only stages the static assets the
// app references: it copies assets/ into public/assets/ and writes the
// root-relative site.css / site.js consumed by app/layout.tsx and
// components/site-enhancements.tsx.
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';

await mkdir('public', { recursive: true });
await cp('assets', 'public/assets', { recursive: true });

// Root-relative URLs are necessary on nested /cars/[slug] routes.
await writeFile('public/site.css', (await readFile('assets/css/styles.css', 'utf8')).replaceAll("url('assets/", "url('/assets/"));

const legacyScript = await readFile('assets/js/site.js', 'utf8');
if (!legacyScript.includes('initNav(); initSheet();')) throw new Error('Review changed legacy bootstrap');
// The app owns menu focus/lifecycle; avoid double listeners from the retained script.
await writeFile('public/site.js', legacyScript.replace('initNav(); initSheet();', 'initNav();').replace('initGallery(); initInventory();', ''));

console.log('Prepared shared assets for the static export.');
