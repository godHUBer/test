import type {MetadataRoute} from 'next';
import {inventoryConfig} from '@/lib/inventory/config';
import {siteUrl} from '@/lib/deploy';
export default function robots():MetadataRoute.Robots{
  const sitemap=siteUrl('/sitemap.xml');
  const live=inventoryConfig().mode==='supabase'&&siteUrl('/');
  return {rules:live?{userAgent:'*',allow:'/',disallow:['/admin','/auth']}:{userAgent:'*',disallow:'/'},...(live&&sitemap?{sitemap}:{})};
}
export const dynamic='force-static';
