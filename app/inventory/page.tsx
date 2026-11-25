import type {Metadata} from 'next';
import {loadPublicSite,loadListing} from '@/lib/inventory/server';
import {parseFilters,type QueryInput} from '@/lib/inventory/query';
import {publicMetadata} from '@/lib/inventory/seo';
import {PublicShell} from '@/components/public-shell';
import {ListingPage} from '@/components/inventory/listing-page';
export const dynamic='force-dynamic';
export async function generateMetadata({searchParams}:{searchParams:Promise<QueryInput>}):Promise<Metadata>{
  const site=await loadPublicSite();const listing=await loadListing(site,parseFilters(await searchParams));
  const metadata=publicMetadata(site,'/inventory','Browse the collection','Search vehicle records by make, price, year, fuel, transmission and body type. Confirm current availability with the showroom.');
  if(!listing)metadata.robots={index:false,follow:false};return metadata;
}
export default async function InventoryPage({searchParams}:{searchParams:Promise<QueryInput>}){
  const site=await loadPublicSite();const filters=parseFilters(await searchParams);const listing=await loadListing(site,filters);
  return <PublicShell route="/inventory" site={site}><ListingPage site={site} filters={{...filters,page:listing?.page??filters.page}} listing={listing}/></PublicShell>;
}
