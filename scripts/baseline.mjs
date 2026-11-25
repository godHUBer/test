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
const paths = [...(await readdir(root)).filter(p => p.endsWith('.html')), 'build.py', ...await files('src'), ...await files('assets')].sort();
const hashes = Object.fromEntries(await Promise.all(paths.map(async p => [p, createHash('sha256').update(await readFile(join(root, p))).digest('hex')])));
const file = 'docs/legacy-baseline.json';
if (process.argv.includes('--check')) {
  const baseline = JSON.parse(await readFile(file, 'utf8'));
  if (JSON.stringify(hashes) !== JSON.stringify(baseline.hashes)) throw new Error('Legacy files changed: review baseline deliberately.');
  console.log(`Legacy baseline intact: ${paths.length} files.`);
} else if (process.argv.includes('--record')) {
  await writeFile(file, JSON.stringify({ description: 'Phase 1 read-only legacy baseline; Python generator not executed.', hashes }, null, 2) + '\n');
} else throw new Error('Use --check or --record');
