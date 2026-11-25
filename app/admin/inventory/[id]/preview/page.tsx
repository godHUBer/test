/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {loadVehicleEditor} from '@/lib/admin/queries';
import {AdminFrame,InventoryBlocked} from '@/components/admin/frame';
import {formatPrice,publicImage} from '@/lib/inventory/model';
import {lakhToRupees} from '@/lib/format';
import {authConfig} from '@/lib/supabase/config';
export default async function Preview({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const result=await loadVehicleEditor(id);if(result.state==='blocked')return <InventoryBlocked/>;if(result.state==='missing')notFound();if(result.state==='error')return <AdminFrame title="Preview unavailable"><p>The authorised read failed.</p></AdminFrame>;
  const {car,media,urls}=result;const legacy=publicImage(car.photo_stock,authConfig()?.url);
  return <AdminFrame title={`Private preview: ${car.year} ${car.make} ${car.model}`}><p>This is a staff-only preview, not a public listing or an availability claim. Status: {car.status} · version {car.version}. Signed private photo links expire after 60 seconds.</p><Link href={`/admin/inventory/${id}`}>Back to editor</Link><h2>{car.variant}</h2><p>{formatPrice(lakhToRupees(String(car.price_lakh)))}</p><p>{car.overview||'No overview supplied.'}</p><dl className="spec-table">{[['Recorded year',car.year],['Odometer',car.km],['Fuel',car.fuel],['Transmission',car.transmission??'Not stated'],['Registration region',car.reg],['Location',car.location]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="admin-media-grid">{car.media_order.length?car.media_order.map(assetId=>{const asset=media.find(m=>m.id===assetId);return <figure key={assetId}>{urls[assetId]?<img src={urls[assetId]} alt={`${car.make} ${car.model} selected photograph`} width={900} height={675}/>:<p>Photo preview unavailable for your role.</p>}<figcaption>{asset?.state??'Unavailable asset'}</figcaption></figure>;}):legacy?<img src={legacy} alt={`${car.make} ${car.model} legacy cover`} width={900} height={675}/>:<p>No selected cover photo.</p>}</div>
  </AdminFrame>;
}
