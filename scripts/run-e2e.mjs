import chromium from '@sparticuz/chromium';
import { spawnSync } from 'node:child_process';
import { brotliDecompressSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// npm-packaged Chromium and NSS libraries avoid external browser/apt downloads.
// An existing Chrome installation can instead be supplied through the env override.
let temporary;
const env = { ...process.env };
if (!env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error('Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to an installed Chrome executable on this platform.');
  }
  temporary = mkdtempSync(join(tmpdir(), 'sohan-browser-'));
  const archive = join(temporary, 'libraries.tar');
  const packageArchive = new URL('../node_modules/@sparticuz/chromium/bin/al2023.tar.br', import.meta.url);
  writeFileSync(archive, brotliDecompressSync(readFileSync(packageArchive)));
  const extraction = spawnSync('tar', ['-xf', archive, '-C', temporary], { stdio: 'inherit' });
  if (extraction.status !== 0) throw new Error('Could not extract browser support libraries');
  env.LD_LIBRARY_PATH = [join(temporary, 'lib'), env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = await chromium.executablePath();
}
// Ephemeral local TLS for the read-only API fixture; no real credentials or network calls.
mkdirSync('.generated/test-tls',{recursive:true});
if(!existsSync('.generated/test-tls/cert.pem') || !existsSync('.generated/test-tls/key.pem') || spawnSync('openssl',['x509','-checkend','3600','-noout','-in','.generated/test-tls/cert.pem'],{stdio:'ignore'}).status!==0){
  const cert=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','2','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-keyout','.generated/test-tls/key.pem','-out','.generated/test-tls/cert.pem'],{stdio:'ignore'});
  if(cert.status!==0)throw new Error('OpenSSL is required for the local test fixture');
}
try {
  const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], { stdio: 'inherit', env });
  process.exitCode = result.status ?? 1;
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}
