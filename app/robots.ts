import type {MetadataRoute} from 'next';
import {inventoryConfig} from '@/lib/inventory/config';
import {absoluteOrigin} from '@/lib/inventory/model';
export default function robots():MetadataRoute.Robots{
  const origin=absoluteOrigin(process.env.SITE_URL);const live=inventoryConfig().mode==='supabase'&&origin;
  return {rules:live?{userAgent:'*',allow:'/',disallow:['/admin','/auth']}:{userAgent:'*',disallow:'/'},...(live?{sitemap:`${origin}/sitemap.xml`}:{})};
}
export const dynamic='force-dynamic';
