import type {MetadataRoute} from 'next';
import {loadPublicSite} from '@/lib/inventory/server';
import {absoluteOrigin} from '@/lib/inventory/model';
import {inventoryConfig} from '@/lib/inventory/config';
import {generalRoutes} from '@/lib/routes';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const origin=absoluteOrigin(process.env.SITE_URL);
  if(inventoryConfig().mode!=='supabase'||!origin)return[];
  const site=await loadPublicSite();if(site.mode!=='supabase')throw new Error('Public inventory unavailable for sitemap');
  return [{url:new URL('/services',origin).href},...generalRoutes.map(p=>({url:new URL(p.route,origin).href})),...site.available.map(c=>({url:new URL(`/cars/${c.id}`,origin).href,...(c.updatedAt?{lastModified:new Date(c.updatedAt)}:{})}))];
}
