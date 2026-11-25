import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {loadPublicSite,loadPublicVehicle,loadAllVehicleIds} from '@/lib/inventory/server';
import {absoluteOrigin,vehicleName} from '@/lib/inventory/model';
import {publicMetadata,vehicleSchema,serialiseSchema} from '@/lib/inventory/seo';
import {PublicShell} from '@/components/public-shell';
import {VehicleDetail} from '@/components/inventory/detail-page';
import {EmptyState} from '@/components/inventory/shared';
type Props={params:Promise<{slug:string}>};
export async function generateStaticParams(){
  const ids=await loadAllVehicleIds();
  return ids.map((id)=>({slug:id}));
}
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {slug}=await params;const [site,record]=await Promise.all([loadPublicSite(),loadPublicVehicle(slug)]);
  if(record.state!=='found')return{title:record.state==='error'?'Vehicle temporarily unavailable':'Vehicle not found',robots:{index:false,follow:false}};
  const car=record.vehicle;const data=publicMetadata(site,`/cars/${car.id}`,vehicleName(car),`${car.variant}. ${car.status==='sold'?'Sold listing retained for reference.':car.status==='reserved'?'Reserved vehicle.':'Confirm asking price, availability and condition with the showroom.'}`);
  if(car.cover&&absoluteOrigin(process.env.SITE_URL))data.openGraph={...data.openGraph,images:[{url:new URL(car.cover,process.env.SITE_URL).href,alt:vehicleName(car)}]};
  return data;
}
export default async function CarPage({params}:Props){
  const {slug}=await params;const [site,record]=await Promise.all([loadPublicSite(),loadPublicVehicle(slug)]);
  if(record.state==='missing')notFound();
  const origin=absoluteOrigin(process.env.SITE_URL);
  return <PublicShell route={`/cars/${slug}`} site={site}>{record.state==='error'||site.mode==='error'?<main id="main" className="band"><div className="wrap"><EmptyState title="We could not load this vehicle"><p>The database read failed. This is not a missing or sold listing. Please retry or contact the showroom.</p></EmptyState></div></main>:<>
    <VehicleDetail car={record.vehicle} site={site}/>
    {site.mode==='supabase'&&origin&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:serialiseSchema(vehicleSchema(record.vehicle,origin))}}/>}
  </>}</PublicShell>;
}
