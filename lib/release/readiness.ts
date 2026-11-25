import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {absoluteOrigin} from '../inventory/model';
export const SELECTED_PROJECT='vxlxoiycolfojcnhnzfr';
export const releaseGates=['backup_restore','real_supabase_security','native_concurrency','import_reconciliation','staff_acceptance','privacy_retention','deployment_tls','monitoring_recovery','launch_approval'] as const;
export type Gate=typeof releaseGates[number];
function jwtRole(value:string|undefined):string|null{
 if(!value?.startsWith('eyJ'))return null;
 try{const role=JSON.parse(Buffer.from(value.split('.')[1]??'','base64url').toString()).role;return typeof role==='string'?role:null;}catch{return null;}
}
export const sha256=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
export function runtimeProblems(env:Record<string,string|undefined>):string[]{
 const problems:string[]=[];
 if(env.PUBLIC_INVENTORY_MODE!=='supabase')problems.push('Live public inventory mode is not enabled.');
 const site=absoluteOrigin(env.SITE_URL);
 const hostname=site?new URL(site).hostname:'';
 if(!site||hostname==='localhost'||hostname.endsWith('.localhost')||hostname.endsWith('.e2b.app')||!hostname.includes('.')||isIP(hostname.replace(/^\[|\]$/g,'')))problems.push('An approved non-preview HTTPS SITE_URL is required.');
 for(const name of ['NEXT_PUBLIC_SUPABASE_URL','PUBLIC_SUPABASE_URL']){
  const value=env[name]|| (name==='PUBLIC_SUPABASE_URL'?env.NEXT_PUBLIC_SUPABASE_URL:undefined);
  if(absoluteOrigin(value)!==`https://${SELECTED_PROJECT}.supabase.co`)problems.push(`${name} must use the selected project HTTPS origin.`);
 }
 for(const name of ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','PUBLIC_SUPABASE_PUBLISHABLE_KEY']){
  const key=env[name]||(name==='PUBLIC_SUPABASE_PUBLISHABLE_KEY'?env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:undefined);
  const valid=!!key?.startsWith('sb_publishable_')||jwtRole(key)==='anon';
  if(!valid)problems.push(`${name} must be an anonymous/publishable key, never a service credential.`);
 }
 if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0'||env.NODE_EXTRA_CA_CERTS?.includes('.generated/test-tls'))problems.push('Test-only or disabled TLS verification must not be deployed.');
 if(env.BUSINESS_INTAKE_ENABLED!=='true')problems.push('Durable business intake is not enabled.');
 for(const name of ['SUPABASE_SECRET_KEY','MEDIA_STORAGE_SECRET_KEY','INTAKE_SECRET_KEY']){
  const key=env[name],valid=!!key?.startsWith('sb_secret_')||jwtRole(key)==='service_role';
  if(!valid)problems.push(`${name} requires a server-only service credential for the full launch scope.`);
 }
 if((env.INTAKE_HASH_SECRET?.length??0)<32)problems.push('A stable random INTAKE_HASH_SECRET of at least 32 characters is required.');
 if(env.INTAKE_TRUSTED_IP_HEADER&&!['cf-connecting-ip','x-real-ip'].includes(env.INTAKE_TRUSTED_IP_HEADER))problems.push('Unsupported trusted-network header.');
 // Never print values, token claims, URL input or arbitrary environment names in a report.
 const secretValues=['SUPABASE_SECRET_KEY','MEDIA_STORAGE_SECRET_KEY','INTAKE_SECRET_KEY','INTAKE_HASH_SECRET'].map(k=>env[k]).filter((s):s is string=>!!s);
 if(Object.entries(env).some(([name,value])=>name.startsWith('NEXT_PUBLIC_')&&!!value&&(value.startsWith('sb_secret_')||secretValues.includes(value)||jwtRole(value)==='service_role')))problems.push('A server secret is exposed through a NEXT_PUBLIC_ variable.');
 return problems;
}
interface GateEvidence {status?:unknown;artifact?:unknown;sha256?:unknown;reviewedBy?:unknown;reviewedAt?:unknown}
export function assessEvidence(input:unknown,digest:string,readArtifact:(path:string)=>Buffer,now=Date.now()){
 const root=input&&typeof input==='object'?input as Record<string,unknown>:{};
 const common:string[]=[];
 if(root.schemaVersion!==1)common.push('Evidence schemaVersion must be 1.');
 if(root.projectRef!==SELECTED_PROJECT)common.push('Evidence is not for the selected Supabase project.');
 if(root.releaseDigest!==digest)common.push('Evidence does not match this release candidate digest.');
 const records=root.gates&&typeof root.gates==='object'?root.gates as Record<string,GateEvidence>:{};
 const gates=releaseGates.map(name=>{
  const record=records[name]??{},reasons:string[]=[];
  if(record.status!=='passed')reasons.push('Review is pending.');
  if(typeof record.reviewedBy!=='string'||record.reviewedBy.trim().length<2)reasons.push('An accountable reviewer is required.');
  const time=typeof record.reviewedAt==='string'&&/^\d{4}-\d{2}-\d{2}T.*Z$/.test(record.reviewedAt)?Date.parse(record.reviewedAt):NaN;
  if(!Number.isFinite(time)||time>now+30000||time<now-30*86400000)reasons.push('A review within the last 30 days is required.');
  const path=record.artifact;
  if(typeof path!=='string'||!/^\.local\/release\/[a-zA-Z0-9_./-]+$/.test(path)||path.split('/').some(s=>s==='..'||!s))reasons.push('Evidence must reference an existing local release artifact.');
  else try{if(typeof record.sha256!=='string'||!/^[a-f0-9]{64}$/.test(record.sha256)||sha256(readArtifact(path))!==record.sha256)reasons.push('Evidence artifact hash is missing or does not match.');}catch{reasons.push('Evidence artifact is missing or unreadable.');}
  return{name,passed:reasons.length===0,reasons};
 });
 return{passed:common.length===0&&gates.every(g=>g.passed),common,gates};
}
