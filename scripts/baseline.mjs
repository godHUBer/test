import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const root = process.cwd();
async function files(dir) {
  const result = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(path)); else result.push(path);
  }
  return result;
}
// Baseline the reviewed content and asset sources of the Next.js static export.
// The legacy static HTML and build.py have been removed; editorial copy now lives
// in lib/editorial/templates.ts and the vehicle/brand data in assets/data.
const paths = ['lib/editorial/templates.ts', ...await files('assets')].sort();
const hashes = Object.fromEntries(await Promise.all(paths.map(async p => [p, createHash('sha256').update(await readFile(join(root, p))).digest('hex')])));
const file = 'docs/legacy-baseline.json';
if (process.argv.includes('--check')) {
  const baseline = JSON.parse(await readFile(file, 'utf8'));
  if (JSON.stringify(hashes) !== JSON.stringify(baseline.hashes)) throw new Error('Content sources changed: review baseline deliberately.');
  console.log(`Content baseline intact: ${paths.length} files.`);
} else if (process.argv.includes('--record')) {
  await writeFile(file, JSON.stringify({ description: 'Reviewed content and asset sources for the Next.js static export.', hashes }, null, 2) + '\n');
} else throw new Error('Use --check or --record');
