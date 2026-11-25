// TEST ONLY: local read-only PostgREST-compatible fixture. Never deploy as an API.
import https from 'node:https';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync('assets/data/inventory.json','utf8'));
const requests=[];let scenario='normal';
const allowedCars='id,year,make,model,variant,km,fuel,transmission,body,price_lakh,price_note,reg,location,highlights,overview,listing_url,status,featured,sort_order,photo_stock,photos_gallery,updated_at'.split(',');
const allowedBrand='name,tagline,phone_display,phone_href,email,address_short,address_city,area,map_url,services,hours,verified_on'.split(',');
const brand={id:1,name:'Sohan Automobile',tagline:data.brand.tagline,phone_display:data.brand.phoneDisplay,phone_href:data.brand.phoneHref,email:data.brand.email,address_short:data.brand.addressShort,address_city:data.brand.addressCity,area:data.brand.area,map_url:data.brand.mapUrl,services:data.brand.services,hours:'Confirmed fixture hours: 10:00–18:00',verified_on:'2026-11-24'};
function rows(){
  const cars=data.cars.map((c,i)=>({...c,status:'available',sort_order:i,price_lakh:c.priceLakh,price_note:c.priceNote,listing_url:c.listingUrl,photo_stock:`assets/img/stock/${c.id}.jpg`,photos_gallery:[`assets/img/gallery/${c.id}-1.jpg`,`assets/img/gallery/${c.id}-2.jpg`],updated_at:'2026-11-24T12:00:00Z',acquisition_cost:'DO_NOT_EXPOSE',internal_notes:'PRIVATE_CANARY'}));
  const fresh={...cars[0],id:'new-arrival',make:'Test Motors',model:'Fresh Model',variant:'Public <script>alert("xss")</script> variant',price_lakh:4.25,featured:true,sort_order:-1,overview:'A newly added public record.',highlights:['Dealer note <b>not markup</b>']};
  cars.forEach(c=>{c.featured=false;});
  if(['sold','reserved','hidden'].includes(scenario))fresh.status=scenario;
  if(scenario==='bad-media'){fresh.photo_stock='javascript:alert(1)';fresh.photos_gallery=[];}
  if(scenario==='empty')cars.forEach(c=>{c.status='sold';});
  if(scenario==='one')return [fresh];
  return [...cars,fresh,{...fresh,id:'private-draft',status:'draft'},{...fresh,id:'private-hidden',status:'hidden'},{...fresh,id:'old-archive',status:'archived'}].map(c=>scenario==='empty'?{...c,status:'sold'}:c);
}
function like(value,pattern,insensitive){
  let regex='^';
  for(let i=0;i<pattern.length;i++){
    const c=pattern[i];
    if(c==='\\'&&i+1<pattern.length){const n=pattern[++i];regex+=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
    else if(c==='%')regex+='.*';else if(c==='_')regex+='.';else regex+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }
  return new RegExp(regex+'$',insensitive?'iu':'u').test(String(value??''));
}
https.createServer({key:readFileSync('.generated/test-tls/key.pem'),cert:readFileSync('.generated/test-tls/cert.pem')},(req,res)=>{
  const url=new URL(req.url,'https://localhost:3443');
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  if(url.pathname==='/__health')return send(200,{ok:true});
  if(url.pathname==='/__scenario'){
    const next=url.searchParams.get('name');if(!['normal','sold','reserved','hidden','empty','error','one','bad-media','leak'].includes(next))return send(400,{});
    scenario=next;requests.length=0;return send(200,{scenario});
  }
  if(url.pathname==='/__requests')return send(200,requests);
  requests.push({method:req.method,path:url.pathname,query:Object.fromEntries(url.searchParams),hasCookie:!!req.headers.cookie,publicKey:req.headers.apikey==='sb_publishable_fixture_only',publicAuthorization:req.headers.authorization==='Bearer sb_publishable_fixture_only'});
  if(req.method!=='GET')return send(405,{message:'Only anonymous reads allowed'});
  if(req.headers.apikey!=='sb_publishable_fixture_only')return send(401,{message:'Expected fixture publishable key'});
  if(scenario==='error')return send(503,{message:'Simulated source outage'});
  const table=url.pathname.split('/').at(-1);
  if(!['cars','brand_settings'].includes(table))return send(403,{message:'Private table forbidden'});
  const selected=(url.searchParams.get('select')??'').split(',');const allowed=table==='cars'?allowedCars:allowedBrand;
  if(!selected.length||selected.some(key=>!allowed.includes(key)))return send(403,{message:'Explicit public column projection required'});
  let result=table==='cars'?rows():[brand];
  for(const [key,condition] of url.searchParams){
    if(['select','order','limit','offset'].includes(key))continue;
    if(scenario==='leak'&&key==='status')continue;
    const dot=condition.indexOf('.');const op=condition.slice(0,dot);const value=condition.slice(dot+1);
    result=result.filter(row=>op==='eq'?String(row[key])===value:op==='gte'?Number(row[key])>=+value:op==='lt'?Number(row[key])<+value:op==='is'?row[key]===null:op==='in'?value.slice(1,-1).split(',').includes(String(row[key])):op==='like'||op==='ilike'?like(row[key],value,op==='ilike'):false);
  }
  const order=(url.searchParams.get('order')??'').split(',').filter(Boolean);
  result.sort((a,b)=>{for(const clause of order){const [key,dir]=clause.split('.');const av=a[key]??false;const bv=b[key]??false;const comp=typeof av==='number'||typeof av==='boolean'?Number(av)-Number(bv):String(av).localeCompare(String(bv));if(comp)return dir==='desc'?-comp:comp;}return 0;});
  const count=result.length;const offset=Number(url.searchParams.get('offset')??0);const limit=Number(url.searchParams.get('limit')??1000);
  result=result.slice(offset,offset+limit).map(row=>Object.fromEntries(selected.map(key=>[key,row[key]??null])));
  res.setHeader('Content-Range',`${offset}-${Math.max(offset,offset+result.length-1)}/${count}`);
  if(req.headers.accept?.includes('vnd.pgrst.object+json'))return result.length===1?send(200,result[0]):send(406,{code:'PGRST116',details:`The result contains ${result.length} rows`});
  return send(200,result);
}).listen(3443,'0.0.0.0',()=>console.log('Public API fixture ready on 3443'));
