import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {legacyRows} from '../../lib/release/reconcile';
import inventory from '../../assets/data/inventory.json';
const run=(file:string,args:string[],env:NodeJS.ProcessEnv=process.env)=>spawnSync(process.execPath,['--import','tsx',file,...args],{encoding:'utf8',env,timeout:30000});
test('release CLI writes manifest but refuses launch on missing/unverified evidence and snapshot configuration',()=>{
 let result=run('scripts/release-check.ts',['--manifest']);assert.equal(result.status,0,result.stderr);const manifest=JSON.parse(readFileSync('.generated/release-manifest.json','utf8'));assert.match(manifest.releaseDigest,/^[a-f0-9]{64}$/);
 result=run('scripts/release-check.ts',['--evidence','.local/release/nonexistent-evidence.json'],{...process.env,PUBLIC_INVENTORY_MODE:'snapshot',NEXT_PUBLIC_LEAK:'sb_secret_DO_NOT_LOG'});assert.equal(result.status,1,result.stderr);assert(!result.stdout.includes('DO_NOT_LOG'));assert(!result.stderr.includes('DO_NOT_LOG'));const report=JSON.parse(readFileSync('.generated/release-readiness.json','utf8'));assert.equal(report.decision,'BLOCKED');assert(!report.passed);assert.equal(report.gates.length,9);assert(report.gates.every((gate:{passed:boolean})=>!gate.passed));
 assert.equal(run('scripts/release-check.ts',[]).status,2);
});
test('reconciliation CLI succeeds on synthetic exact projection and rejects malformed or differing input; never imports',()=>{
 mkdirSync('.generated',{recursive:true});const path='.generated/reconcile-test-input.json';const projection=legacyRows(inventory.cars).map(row=>({...row,status:'draft'}));writeFileSync(path,JSON.stringify(projection));
 let result=run('scripts/inventory-reconcile.ts',['--input',path]);assert.equal(result.status,0,result.stderr);let report=JSON.parse(readFileSync('.generated/inventory-reconciliation.json','utf8'));assert.equal(report.remoteWrites,0);assert.equal(report.availabilityConfirmed,false);assert.equal(report.legacyMedia.length,45);assert(report.legacyMedia.every((m:{sha256:string})=>m.sha256?.length===64));
 writeFileSync(path,JSON.stringify(projection.slice(1)));result=run('scripts/inventory-reconcile.ts',['--input',path]);assert.equal(result.status,1);report=JSON.parse(readFileSync('.generated/inventory-reconciliation.json','utf8'));assert.deepEqual(report.missing,['creta-2018']);writeFileSync(path,'{"bad":true}');result=run('scripts/inventory-reconcile.ts',['--input',path]);assert.equal(result.status,2);assert(!result.stderr.includes('"bad"'));report=JSON.parse(readFileSync('.generated/inventory-reconciliation.json','utf8'));assert.equal(report.inputValid,false);assert.equal(report.projectionMatches,false);
});
