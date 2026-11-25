import {readFileSync,existsSync,mkdirSync,writeFileSync,statSync} from 'node:fs';
import {legacyRows,reconcileInventory} from '../lib/release/reconcile';
import {sha256} from '../lib/release/readiness';
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--input'){console.error('Usage: npm run inventory:reconcile -- --input .local/release/public-cars.json (offline; no database connection)');process.exit(2);}
try{
 if(statSync(args[1]).size>10*1024*1024)throw new Error('Input exceeds the 10 MiB reconciliation limit.');
 const source=readFileSync('assets/data/inventory.json','utf8'),snapshot=JSON.parse(source),input=readFileSync(args[1]);
 const report=reconcileInventory(legacyRows(snapshot.cars),JSON.parse(input.toString()));
 const media=snapshot.cars.flatMap((car:{id:string})=>[`assets/img/stock/${car.id}.jpg`,... [1,2].map(i=>`assets/img/gallery/${car.id}-${i}.jpg`)]).map((path:string)=>({path,present:existsSync(path),sha256:existsSync(path)?sha256(readFileSync(path)):null}));
 mkdirSync('.generated',{recursive:true});writeFileSync('.generated/inventory-reconciliation.json',JSON.stringify({...report,inputValid:true,generatedAt:new Date().toISOString(),sourceSha256:sha256(source),inputSha256:sha256(input),legacyMedia:media,mediaNotice:'Local legacy byte hashes only; not a remote Storage download/restore check or claim that replacement photos must match legacy bytes.'},null,2)+'\n');
 console.log(`Offline reconciliation: ${report.expectedCount} expected, ${report.receivedCount} received. Projection ${report.projectionMatches?'matches':'needs review'}. Availability remains UNVERIFIED. Report: .generated/inventory-reconciliation.json`);
 process.exitCode=report.projectionMatches&&media.every((m:{present:boolean})=>m.present)?0:1;
}catch{mkdirSync('.generated',{recursive:true});writeFileSync('.generated/inventory-reconciliation.json',JSON.stringify({schemaVersion:1,dryRun:true,remoteWrites:0,inputValid:false,projectionMatches:false,availabilityConfirmed:false,generatedAt:new Date().toISOString(),notice:'Reconciliation failed; no successful prior report should be used.'},null,2)+'\n');console.error('Could not reconcile: check the JSON array shape, file access, row identities and size limit. No raw input was logged.');process.exitCode=2;}
