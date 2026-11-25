import {readFileSync,readdirSync,lstatSync,realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {assessEvidence,runtimeProblems,sha256,SELECTED_PROJECT} from '../lib/release/readiness';
const args=process.argv.slice(2),manifestOnly=args.length===1&&args[0]==='--manifest';
if(!manifestOnly&&(args.length!==2||args[0]!=='--evidence')){console.error('Usage: npm run release:manifest OR npm run release:check -- --evidence .local/release/evidence.json');process.exit(2);}
// Candidate identity covers first-party application, SQL, scripts, tests, docs and dependency/config sources.
// Never scan .env, node_modules, generated output, local evidence, backups or credentials.
const roots=['app','components','lib','scripts','supabase','tests','docs','.github','assets'];
const files=['package.json','package-lock.json','next.config.ts','playwright.config.ts','proxy.ts','tsconfig.json','eslint.config.mjs','README.md','plan.md','.env.example','.gitignore'];
function walk(dir:string){for(const file of readdirSync(dir,{withFileTypes:true})){const path=dir+'/'+file.name;if(file.isSymbolicLink())throw new Error('Release sources may not be symlinks');if(file.isDirectory())walk(path);else if(file.isFile())files.push(path);}}
for(const root of roots){if(lstatSync(root).isSymbolicLink())throw new Error('Release roots may not be symlinks');walk(root);}
for(const file of files)if(lstatSync(file).isSymbolicLink())throw new Error('Release sources may not be symlinks');
const releaseDigest=sha256(files.sort().map(path=>path+'\0'+sha256(readFileSync(path))).join('\n'));
const manifest={schemaVersion:1,projectRef:SELECTED_PROJECT,releaseDigest,sourceFileCount:files.length,generatedAt:new Date().toISOString(),scope:'First-party sources, protected legacy inputs/assets, config and lockfile; not a built-artifact signature or proof of deployment.'};
mkdirSync('.generated',{recursive:true});writeFileSync('.generated/release-manifest.json',JSON.stringify(manifest,null,2)+'\n');
if(manifestOnly){console.log(`Release candidate: ${releaseDigest}\nManifest: .generated/release-manifest.json\nThis is not launch approval.`);}
else{
 let evidence:unknown=null;
 try{const path=realpathSync(resolve(args[1]));if(!path.startsWith(resolve('.local/release')+sep)||!lstatSync(path).isFile()||lstatSync(path).size>1024*1024)throw new Error();evidence=JSON.parse(readFileSync(path,'utf8'));}catch{console.error('Evidence file is missing, invalid, too large or outside .local/release. No input contents were logged.');}
 const assessment=assessEvidence(evidence,releaseDigest,path=>{
  const actual=realpathSync(path),inside=relative(resolve('.local/release'),actual);
  if(inside.startsWith('..')||!inside||lstatSync(actual).size>2*1024*1024)throw new Error('Invalid evidence artifact');
  return readFileSync(actual);
 });
 const environment=runtimeProblems(process.env),passed=assessment.passed&&environment.length===0;
 const report={...manifest,...assessment,passed,decision:passed?'REVIEWED_CANDIDATE':'BLOCKED',environment,notice:'Evidence is human-supplied and hash-checked, not independently certified. Passing never applies migrations, deploys, verifies provider behaviour or authorises itself.'};
 writeFileSync('.generated/release-readiness.json',JSON.stringify(report,null,2)+'\n');
 console.log(`Release candidate: ${releaseDigest}\nLaunch readiness: ${report.decision}\n${assessment.gates.filter(g=>!g.passed).length} gates pending; ${environment.length} runtime configuration issues.\nReport: .generated/release-readiness.json`);
 process.exitCode=passed?0:1;
}
