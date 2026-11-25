// LOCAL TEST INFRASTRUCTURE ONLY. Synthetic Auth/Storage facade + actual isolated PostgreSQL RPC/RLS.
// This is deliberately not a Supabase server and must never be deployed or pointed at real data.
import https from 'node:https';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
async function main(){
const db=new PGlite();
await db.exec(readFileSync('supabase/tests/legacy-fixture.sql','utf8'));
await db.exec("insert into cars(id,year,make,model,variant,km,fuel,body,price_lakh,reg,photo_stock) values('phase5-view-car',2020,'Fixture','Viewing Car','Base',10000,'Petrol','SUV',5,'Test region','/assets/img/stock/creta-2018.jpg')");
await db.exec(readFileSync('supabase/migrations/20261124180000_harden_existing_admin_security.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20261124210000_staff_inventory_workflow.sql','utf8'));
await db.exec(readFileSync('supabase/migrations/20261124233000_business_workflows.sql','utf8'));
const identities={staff:'30000000-0000-4000-8000-000000000001',manager:'30000000-0000-4000-8000-000000000002',owner:'30000000-0000-4000-8000-000000000003',pending:'30000000-0000-4000-8000-000000000004',inactive:'30000000-0000-4000-8000-000000000005'};
for(const [role,id]of Object.entries(identities)){await db.query('insert into auth.users(id,email) values($1,$2)',[id,role+'@fixture.test']);await db.query('update admin_profiles set role=$2,is_active=$3 where user_id=$1',[id,role==='inactive'?'staff':role,role!=='inactive']);}
await db.exec("insert into brand_settings(id,name,phone_display,phone_href,email) values(1,'Sohan Automobile','Fixture phone','+919831189375','fixture@example.test')");
await db.exec("insert into service_catalogue(id,name,description,active) values('50000000-0000-4000-8000-000000000001','Fixture service','Local test-only service',true)");
const objects=new Map<string,Buffer>(),signed=new Map<string,string>();
let serial=Promise.resolve();
function token(role:keyof typeof identities,aal:string){const user={id:identities[role],aud:'authenticated',email:role+'@fixture.test',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString(),factors:[]};const claims={sub:user.id,role:'authenticated',aal,aud:'authenticated',iss:'https://localhost:3444/auth/v1',exp:Math.floor(Date.now()/1000)+7200,iat:Math.floor(Date.now()/1000),amr:[{method:aal==='aal2'?'totp':'password',timestamp:Math.floor(Date.now()/1000)}]};const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');return {access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode(claims)+'.'+Buffer.from('synthetic-not-a-real-signature').toString('base64url'),refresh_token:'synthetic-refresh',expires_in:7200,expires_at:claims.exp,token_type:'bearer',user};}
const funcs=new Set(['admin_security_version','inventory_workflow_version','inventory_overview','save_vehicle','set_car_status','prepare_vehicle_media','finish_vehicle_media','request_media_publication','finish_media_publication','remove_vehicle_media','set_vehicle_photos','save_vehicle_note','business_workflow_version','accept_business_request','business_assignees','business_overview','update_business_request','add_request_note','save_viewing','update_service_job','save_service','save_business_settings']);
const tables=new Set(['cars','admin_profiles','vehicle_media','vehicle_stock_events','activity_log','brand_settings','vehicle_internal_notes','service_catalogue','business_requests','request_notes','business_events','viewing_appointments','service_jobs']);
const identifier=(value:string)=>{if(!/^[a-z_]+$/.test(value))throw new Error('Invalid identifier');return '"'+value+'"';};
https.createServer({key:readFileSync('.generated/test-tls/key.pem'),cert:readFileSync('.generated/test-tls/cert.pem')},(req,res)=>{
 serial=serial.then(async()=>{
  const url=new URL(req.url!,'https://localhost:3444');let responseHeaders:Record<string,string>={};
  const send=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...responseHeaders});res.end(JSON.stringify(value));};
  try{
   if(url.pathname==='/__health')return send(200,{ok:true});
   if(url.pathname==='/__session'){const role=url.searchParams.get('role')??'staff';if(!(role in identities))return send(400,{});return send(200,token(role as keyof typeof identities,url.searchParams.get('aal')==='aal1'?'aal1':'aal2'));}
   let claims:Record<string,unknown>={};const bearer=(req.headers.authorization??'').replace(/^Bearer /,'');
   const service=req.headers.apikey==='sb_secret_media_fixture_only'||req.headers.apikey==='sb_secret_intake_fixture_only';
   try{claims=JSON.parse(Buffer.from(bearer.split('.')[1]??'','base64url').toString());}catch{/* Anonymous or synthetic service key. */}
   const trusted=Object.values(identities).includes(claims.sub as typeof identities.staff)&&Number(claims.exp)>Date.now()/1000;
   if(url.pathname==='/auth/v1/user'){if(!trusted)return send(401,{message:'Invalid synthetic token'});const role=Object.entries(identities).find(([,id])=>id===claims.sub)![0] as keyof typeof identities;return send(200,token(role,String(claims.aal)).user);}
   const chunks:Buffer[]=[];for await(const chunk of req){chunks.push(Buffer.from(chunk));if(chunks.reduce((n,c)=>n+c.length,0)>7*1024*1024)throw new Error('Test request too large');}const bytes=Buffer.concat(chunks);
   let body:Record<string,unknown>={};if(bytes.length&&req.headers['content-type']?.includes('application/json'))body=JSON.parse(bytes.toString());
   if(url.pathname.startsWith('/storage/v1/')){
    const path=decodeURIComponent(url.pathname.slice('/storage/v1/'.length));
    if(path.startsWith('object/sign/')&&req.method==='GET'){
     const key=path.slice('object/sign/'.length);if(signed.get(url.searchParams.get('token')??'')!==key)return send(403,{});const image=objects.get(key);if(!image)return send(404,{});res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private,no-store'});res.end(image);return;
    }
    if(path.startsWith('object/public/')&&req.method==='GET'){const key=path.slice('object/public/'.length);if(!key.startsWith('car-photos/'))return send(403,{});const image=objects.get(key);if(!image)return send(404,{});res.writeHead(200,{'Content-Type':'image/webp'});res.end(image);return;}
    if(!service)return send(403,{message:'Only isolated media broker allowed'});
    if(path.startsWith('object/sign/')&&req.method==='POST'){const key=path.slice('object/sign/'.length);const value=crypto.randomUUID();signed.set(value,key);return send(200,{signedURL:'/object/sign/'+key+'?token='+value});}
    if(path.startsWith('object/')&&req.method==='GET'){const key=path.slice('object/'.length);const image=objects.get(key);if(!image)return send(404,{message:'Not found'});res.writeHead(200,{'Content-Type':'image/webp'});res.end(image);return;}
    if(path.startsWith('object/')&&req.method==='POST'){const key=path.slice('object/'.length);if(objects.has(key))return send(409,{message:'Object exists'});objects.set(key,bytes);return send(200,{Key:key,Id:crypto.randomUUID()});}
    if(path.startsWith('object/')&&req.method==='DELETE'){const bucket=path.slice('object/'.length);for(const prefix of body.prefixes as string[]??[])objects.delete(bucket+'/'+prefix);return send(200,[]);}
    return send(404,{message:'Fixture storage endpoint unsupported'});
   }
   const databaseRole=service?'service_role':trusted?'authenticated':'anon';
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(trusted?claims:{})]);await db.exec(`set role ${databaseRole}`);
   try{
    if(url.pathname.startsWith('/rest/v1/rpc/')){
     const name=url.pathname.split('/').at(-1)!;if(!funcs.has(name)||req.method!=='POST')return send(403,{message:'RPC not allowed'});
     const args=Object.entries(body);const binds=args.map(([key],i)=>`${identifier(key)}=>$${i+1}${['fields','payload'].includes(key)?'::jsonb':key==='asset_ids'?'::uuid[]':''}`).join(',');
     const composite=['prepare_vehicle_media','request_media_publication'].includes(name);
     const result=await db.query<{value:unknown}>(`select to_jsonb(public.${identifier(name)}(${binds})) as value`,args.map(([key,v])=>['fields','payload'].includes(key)?JSON.stringify(v):v));if(name==='business_assignees')return send(200,result.rows.map(row=>row.value));return send(200,composite&&!req.headers.accept?.includes('vnd.pgrst.object+json')?[result.rows[0].value]:result.rows[0].value);
    }
    if(req.method!=='GET')return send(403,{message:'Direct writes forbidden'});
    const table=url.pathname.split('/').at(-1)!;if(!tables.has(table))return send(403,{});
    const projection=(url.searchParams.get('select')??'').split(',').map(identifier).join(',');const values:unknown[]=[];const conditions:string[]=[];
    for(const [key,value] of url.searchParams){
     if(['select','order','limit','offset'].includes(key))continue;const dot=value.indexOf('.'),op=value.slice(0,dot),v=value.slice(dot+1);const column=identifier(key);
     if(op==='in'){values.push(v.slice(1,-1).split(','));conditions.push(`${column}=any($${values.length}::text[])`);}
     else if(op==='is'&&v==='null')conditions.push(`${column} is null`);
     else if(['eq','neq','gte','lt','ilike','like'].includes(op)){values.push(v);conditions.push(`${column} ${{eq:'=',neq:'<>',gte:'>=',lt:'<',ilike:'ilike',like:'like'}[op]} $${values.length}`);}else throw new Error('Unsupported test filter');
    }
    const where=conditions.length?' where '+conditions.join(' and '):'';
    const order=(url.searchParams.get('order')??'').split(',').filter(Boolean).map(clause=>{const [key,dir]=clause.split('.');return identifier(key)+(dir==='desc'?' desc':' asc');}).join(',');
    const offset=Math.max(0,Number(url.searchParams.get('offset')??0)),limit=Math.min(200,Number(url.searchParams.get('limit')??200));
    const count=await db.query<{n:number}>(`select count(*)::int as n from public.${identifier(table)}${where}`,values);
    const result=await db.query(`select ${projection} from public.${identifier(table)}${where}${order?' order by '+order:''} limit ${limit} offset ${offset}`,values);
    responseHeaders={'Content-Range':`${offset}-${offset+result.rows.length-1}/${count.rows[0].n}`};
    return send(200,result.rows);
   }finally{await db.exec('reset role');}
  }catch(error){const value=error as {message?:string;code?:string};console.error('Synthetic fixture error:',url.pathname,value.message);return send(400,{message:value.message??'Test fixture error',code:value.code??'TEST_ERROR'});}
 }).catch(error=>{console.error('Fixture handler failed',error);if(!res.writableEnded){res.statusCode=500;res.end();}});
}).listen(3444,'0.0.0.0',()=>console.log('Isolated admin fixture ready on 3444'));

}
main().catch(error=>{console.error(error);process.exitCode=1;});
