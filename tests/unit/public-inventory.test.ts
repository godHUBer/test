import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {snapshotVehicles,snapshotBrand,parseVehicle,publicImage,formatPrice,PUBLIC_CAR_COLUMNS} from '../../lib/inventory/model';
import {pageOf,parseFilters,inventoryFacts,filterHref} from '../../lib/inventory/query';
import {readAvailable,readListing,readVehicle} from '../../lib/inventory/repository';
import {serialiseSchema,vehicleSchema} from '../../lib/inventory/seo';
import {inventoryConfig} from '../../lib/inventory/config';
const raw=(id='test-car')=>({id,year:2020,make:'Test',model:'Car',variant:'Base',km:100,fuel:'Petrol',transmission:null,body:'SUV',price_lakh:'1.23456',reg:'Test',location:'Test',status:'available',photo_stock:'assets/img/stock/creta-2018.jpg',photos_gallery:[],featured:false,sort_order:1,overview:''});
function client(fetcher:typeof fetch){return createClient('https://public.example.test','sb_publishable_unit_only',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetcher}});}
test('preview data preserves all 15 records, unknowns and exact integer prices',()=>{
  assert.equal(snapshotVehicles.length,15);assert.equal(snapshotVehicles.filter(c=>c.transmission===null).length,10);
  const car=parseVehicle(raw());assert.equal(car.priceRupees,123456);assert.equal(formatPrice(car.priceRupees),'₹ 1.23456 Lakh');
  assert.equal(car.transmission,null);assert.equal(snapshotBrand.verifiedOn,'2026-11-24');
  assert.throws(()=>parseVehicle({...raw(),status:'draft'}));assert.throws(()=>parseVehicle({...raw(),price_lakh:'1.234567'}));
});
test('budget boundaries are half-open, unsafe query options normalise and pagination is stable',()=>{
  const cars=[300000,500000,800000].map((price,i)=>({...snapshotVehicles[0],id:`boundary-${i}`,priceRupees:price}));
  assert.equal(pageOf(cars,parseFilters({budget:'0-3'})).total,0);
  assert.equal(pageOf(cars,parseFilters({budget:'3-5'})).total,1);
  assert.equal(pageOf(cars,parseFilters({budget:'5-8'})).total,1);
  assert.equal(pageOf(cars,parseFilters({budget:'8-99'})).total,1);
  assert.equal(parseFilters({sort:'drop table',page:'-1',year:'2999'}).sort,'featured');
  assert.equal(pageOf(snapshotVehicles,parseFilters({page:'999'})).page,2);
  assert.equal(pageOf(snapshotVehicles,parseFilters({body:'SUV'})).total,6);
  assert.equal(pageOf(snapshotVehicles,parseFilters({trans:'unlisted'})).total,10);
  assert.equal(inventoryFacts(snapshotVehicles.map(c=>({...c,status:'sold'}))).min,null);
  assert.match(filterHref(parseFilters({make:'Test & Motors',body:'SUV',page:'2'}),{page:3}),/make=Test\+%26\+Motors/);
});
test('only approved public image origins and safe local assets are rendered',()=>{
  const origin='https://project.example.test';
  for(const value of ['javascript:alert(1)','https://evil.test/photo.jpg','https://project.example.test/storage/v1/object/sign/car-drafts/secret.jpg?token=secret','../photo.jpg','/assets/img/../private.jpg'])assert.equal(publicImage(value,origin),null);
  assert.equal(publicImage('assets/img/stock/creta-2018.jpg'),'/assets/img/stock/creta-2018.jpg');
  assert.equal(publicImage('car-photos/stock/photo.jpg',origin),origin+'/storage/v1/object/public/car-photos/stock/photo.jpg');
});
test('catalogue respects counts when the server row cap is lower than the requested batch',async()=>{
  const offsets:number[]=[];const rows=[raw('one'),raw('two'),raw('three')];
  const api=client(async(input)=>{
    const url=new URL(String(input));offsets.push(Number(url.searchParams.get('offset')??0));
    assert.equal(url.searchParams.get('status'),'eq.available');assert.equal(url.searchParams.get('select'),PUBLIC_CAR_COLUMNS);
    const offset=offsets.at(-1)!;
    return new Response(JSON.stringify(rows.slice(offset,offset+1)),{headers:{'Content-Type':'application/json','Content-Range':`${offset}-${offset}/3`}});
  });
  assert.equal((await readAvailable(api,'https://public.example.test')).length,3);assert.deepEqual(offsets,[0,1,2]);
});
test('source errors, incomplete pages and leaked private statuses fail rather than become empty stock',async()=>{
  const unavailable=client(async()=>new Response(JSON.stringify({message:'test outage'}),{status:401,headers:{'Content-Type':'application/json'}}));
  await assert.rejects(readAvailable(unavailable,'https://public.example.test'));
  const leaky=client(async()=>new Response(JSON.stringify([{...raw(),status:'draft'}]),{headers:{'Content-Type':'application/json','Content-Range':'0-0/1'}}));
  await assert.rejects(readAvailable(leaky,'https://public.example.test'));
  const capped=client(async()=>new Response(JSON.stringify([raw()]),{headers:{'Content-Type':'application/json','Content-Range':'0-0/15'}}));
  await assert.rejects(readListing(capped,'https://public.example.test',parseFilters({})));
});
test('detail lookups require visible statuses and do not depend on an initial slug list',async()=>{
  const api=client(async(input)=>{
    const url=new URL(String(input));assert.equal(url.searchParams.get('id'),'eq.new-arrival');assert.equal(url.searchParams.get('status'),'in.(available,reserved,sold)');
    return new Response(JSON.stringify([{...raw('new-arrival'),status:'sold'}]),{headers:{'Content-Type':'application/json'}});
  });
  assert.equal((await readVehicle(api,'https://public.example.test','new-arrival'))?.status,'sold');
});
test('structured data uses exact money, safe JSON escaping and actual availability',()=>{
  const car={...snapshotVehicles[0],status:'sold' as const,overview:'</script><script>alert(1)</script>'};
  const schema=vehicleSchema(car,'https://dealer.example.test');assert.equal(schema.offers.availability,'https://schema.org/SoldOut');assert.equal(schema.offers.price,car.priceRupees);
  const json=serialiseSchema(schema);assert.ok(!json.includes('</script>'));assert.ok(json.includes('\\u003c'));assert.equal(JSON.parse(json).description,car.overview);
});
test('public source configuration is explicit and never accepts privileged browser keys',()=>{
  const old={...process.env};
  try{
    delete process.env.PUBLIC_SUPABASE_URL;delete process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.PUBLIC_INVENTORY_MODE;assert.equal(inventoryConfig().mode,'snapshot');
    process.env.PUBLIC_INVENTORY_MODE='supabase';process.env.NEXT_PUBLIC_SUPABASE_URL='https://public.example.test';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_secret_rejected';assert.equal(inventoryConfig().mode,'error');
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_unit_only';assert.equal(inventoryConfig().mode,'supabase');
    process.env.PUBLIC_INVENTORY_MODE='typo';assert.equal(inventoryConfig().mode,'error');
  }finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old);}
});
