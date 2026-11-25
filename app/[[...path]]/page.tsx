import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { generalRoutes } from '@/lib/routes';
import { loadPublicSite } from '@/lib/inventory/server';
import { publicMetadata } from '@/lib/inventory/seo';
import { PublicShell } from '@/components/public-shell';
import { EditorialPage } from '@/components/editorial/editorial-page';

type Props = { params: Promise<{ path?: string[] }> };

const title: Record<string, string> = {
  '/': 'Pre-owned cars in Kolkata',
  '/sell-your-car': 'Sell or exchange your car',
  '/about': 'Our story',
  '/showroom': 'Our showroom',
  '/contact': 'Contact the dealership',
  '/legal': 'Privacy, terms and listing data',
};

export function generateStaticParams() {
  return generalRoutes.map((r) => ({ path: r.route === '/' ? [] : r.route.slice(1).split('/') }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const route = '/' + ((await params).path?.join('/') ?? '');
  if (!title[route]) return {};
  const site = await loadPublicSite();
  return publicMetadata(site, route, title[route], `Explore ${site.brand.name}: dealership information, vehicle records and ways to contact the Kolkata showroom.`);
}

export default async function PublicPage({ params }: Props) {
  const route = '/' + ((await params).path?.join('/') ?? '');
  if (!generalRoutes.some((p) => p.route === route) || !title[route]) notFound();
  const site = await loadPublicSite();
  return <PublicShell route={route} site={site}><EditorialPage route={route} site={site} /></PublicShell>;
}
