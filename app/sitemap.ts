import type {MetadataRoute} from 'next';
import {loadPublicSite} from '@/lib/inventory/server';
import {inventoryConfig} from '@/lib/inventory/config';
import {generalRoutes} from '@/lib/routes';
import {siteUrl} from '@/lib/deploy';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  if(inventoryConfig().mode!=='supabase')return[];
  const site=await loadPublicSite();if(site.mode!=='supabase')throw new Error('Public inventory unavailable for sitemap');
  const routes=['/services',...generalRoutes.map(p=>p.route)];
  return [...routes.map(r=>({url:siteUrl(r)!})),...site.available.map(c=>({url:siteUrl(`/cars/${c.id}`)!,...(c.updatedAt?{lastModified:new Date(c.updatedAt)}:{})}))];
}
export const dynamic='force-static';
