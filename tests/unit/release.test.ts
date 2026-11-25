import test from 'node:test';
import assert from 'node:assert/strict';
import {assessEvidence,releaseGates,runtimeProblems,sha256,SELECTED_PROJECT} from '../../lib/release/readiness';
import {legacyRows,reconcileInventory} from '../../lib/release/reconcile';
import inventory from '../../assets/data/inventory.json';
const now=Date.parse('2026-11-24T12:00:00Z'),artifact=Buffer.from('local test evidence, not real approval'),digest='a'.repeat(64);
function evidence(){return{schemaVersion:1,projectRef:SELECTED_PROJECT,releaseDigest:digest,gates:Object.fromEntries(releaseGates.map(name=>[name,{status:'passed',artifact:'.local/release/'+name+'.md',sha256:sha256(artifact),reviewedBy:'Fixture reviewer',reviewedAt:new Date(now).toISOString()}]))};}
test('launch evidence defaults blocked; binds exact candidate/project, recent reviewer and artifact hash',()=>{
 assert.equal(assessEvidence({},digest,()=>artifact,now).passed,false);assert(assessEvidence(evidence(),digest,()=>artifact,now).passed);
 for(const data of [{...evidence(),releaseDigest:'b'.repeat(64)},{...evidence(),projectRef:'other'},{...evidence(),schemaVersion:2}])assert(!assessEvidence(data,digest,()=>artifact,now).passed);
 for(const patch of [{status:'pending'},{reviewedBy:''},{reviewedAt:'2020-01-01T00:00:00Z'},{reviewedAt:'2026-11-25T12:00:00Z'},{artifact:'../../secrets'},{artifact:'.local/release/../secrets'},{sha256:'b'.repeat(64)}]){const data=evidence();Object.assign(data.gates.backup_restore,patch);assert(!assessEvidence(data,digest,()=>artifact,now).passed);}
 assert(!assessEvidence(evidence(),digest,()=>{throw new Error('missing');},now).passed);assert(!assessEvidence(evidence(),digest,()=>Buffer.from('changed'),now).passed);
});
function environment(){return{SITE_URL:'https://approved-dealer.example',PUBLIC_INVENTORY_MODE:'supabase',NEXT_PUBLIC_SUPABASE_URL:`https://${SELECTED_PROJECT}.supabase.co`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only',SUPABASE_SECRET_KEY:'sb_secret_invitation_test',MEDIA_STORAGE_SECRET_KEY:'sb_secret_media_test',INTAKE_SECRET_KEY:'sb_secret_intake_test',INTAKE_HASH_SECRET:'test-only-stable-secret-32-characters',BUSINESS_INTAKE_ENABLED:'true'};}
test('launch runtime guard rejects snapshot, project mismatch, browser secrets and missing broker config without echoing values',()=>{
 assert.deepEqual(runtimeProblems(environment()),[]);assert(runtimeProblems({}).length>0);
 for(const patch of [{PUBLIC_INVENTORY_MODE:'snapshot'},{SITE_URL:'https://3000-fixture.e2b.app'},{SITE_URL:'https://[::1]'},{SITE_URL:'https://anything.localhost'},{PUBLIC_SUPABASE_URL:'https://another-project.supabase.co'},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_DO_NOT_ECHO'},{INTAKE_SECRET_KEY:''},{INTAKE_HASH_SECRET:'short'},{BUSINESS_INTAKE_ENABLED:'false'},{INTAKE_TRUSTED_IP_HEADER:'x-forwarded-for'},{NEXT_PUBLIC_LEAK:'sb_secret_DO_NOT_ECHO'}]){const issues=runtimeProblems({...environment(),...patch});assert(issues.length>0);assert(!JSON.stringify(issues).includes('DO_NOT_ECHO'));}
});
test('offline inventory reconciliation compares all 15 by ID, exact price, nulls, ordering and media without affirming availability',()=>{
 const expected=legacyRows(inventory.cars);const input=expected.map(row=>({...row,status:'draft'}));
 input[0].price_lakh='6.00000';input[0].photo_stock='/'+input[0].photo_stock;
 const match=reconcileInventory(expected,input);assert(match.projectionMatches);assert.equal(match.expectedCount,15);assert.equal(match.availabilityConfirmed,false);assert(match.records.every(r=>r.status==='draft'&&!r.availabilityConfirmed));
 const changed=structuredClone(input);changed[0].price_lakh='6.00001';changed[0].transmission='Automatic';changed[0].overview='PRIVATE_DO_NOT_COPY';
 const mismatch=reconcileInventory(expected,changed);assert(!mismatch.projectionMatches);assert.deepEqual(mismatch.records[0].differences,['transmission','price_lakh','overview']);assert(!JSON.stringify(mismatch).includes('PRIVATE_DO_NOT_COPY'));
 assert(!reconcileInventory(expected,[...input,input[0]]).projectionMatches);assert.deepEqual(reconcileInventory(expected,input.slice(1)).missing,['creta-2018']);assert.deepEqual(reconcileInventory(expected,[...input,{id:'new-valid-id'}]).extra,['new-valid-id']);assert.throws(()=>reconcileInventory(expected,[{id:'../invalid'}]));assert.throws(()=>reconcileInventory(expected,{}));
});
