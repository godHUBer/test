import {lakhToRupees} from '../format';
type RecordData=Record<string,unknown>;
const fields=['year','make','model','variant','km','fuel','transmission','body','price_lakh','price_note','reg','location','highlights','overview','listing_url','sort_order','featured','photo_stock','photos_gallery'] as const;
export function legacyRows(cars:RecordData[]){return cars.map((car,index)=>({id:car.id,year:car.year,make:car.make,model:car.model,variant:car.variant,km:car.km,fuel:car.fuel,transmission:car.transmission,body:car.body,price_lakh:String(car.priceLakh),price_note:car.priceNote,reg:car.reg,location:car.location,highlights:car.highlights,overview:car.overview,listing_url:car.listingUrl,sort_order:index,featured:car.featured===true,photo_stock:`assets/img/stock/${car.id}.jpg`,photos_gallery:[1,2].map(i=>`assets/img/gallery/${car.id}-${i}.jpg`)}));}
function canonical(key:string,value:unknown):unknown{
 if(key==='price_lakh'){try{return lakhToRupees(String(value));}catch{return {invalid:true};}}
 if(['photo_stock','photos_gallery'].includes(key)){
  if(Array.isArray(value))return value.map(v=>canonical('photo_stock',v));
  return typeof value==='string'?value.replace(/^\/assets\//,'assets/'):value;
 }
 return value;
}
export function reconcileInventory(expected:RecordData[],input:unknown){
 if(!Array.isArray(input)||input.length>5000)throw new Error('Expected a public-projection JSON array of at most 5000 rows.');
 const actual=new Map<string,RecordData>();const duplicates:string[]=[];
 for(const row of input){if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.id!=='string'||!/^[a-z0-9-]{1,120}$/.test(row.id))throw new Error('Invalid reconciliation row identity.');if(actual.has(row.id))duplicates.push(row.id);actual.set(row.id,row as RecordData);}
 const expectedIds=new Set(expected.map(r=>String(r.id)));
 const records=expected.map(row=>{
  const id=String(row.id),found=actual.get(id);
  const differences=found?fields.filter(field=>!(field in found)||JSON.stringify(canonical(field,row[field]))!==JSON.stringify(canonical(field,found[field]))):[...fields];
  const status=typeof found?.status==='string'&&['draft','available','reserved','sold','archived','hidden'].includes(found.status)?found.status:'invalid_or_missing';
  return{id,present:!!found,differences,status,availabilityConfirmed:false};
 });
 const missing=records.filter(r=>!r.present).map(r=>r.id),extra=[...actual.keys()].filter(id=>!expectedIds.has(id)).sort();
 return{schemaVersion:1,dryRun:true,remoteWrites:0,expectedCount:expected.length,receivedCount:input.length,missing,extra,duplicates:[...new Set(duplicates)],records,
  projectionMatches:missing.length===0&&extra.length===0&&duplicates.length===0&&records.every(r=>!r.differences.length&&r.status!=='invalid_or_missing'),
  availabilityConfirmed:false,notice:'Offline field comparison only. Status is reported, never inferred from legacy data. Differences may be legitimate: review them; never overwrite newer records to force a match. No PII, private free text or input values are copied into this report.'};
}
