import type { Metadata } from 'next';
import { Suspense } from 'react';
import { loadPublicSite } from '@/lib/inventory/server';
import { publicMetadata } from '@/lib/inventory/seo';
import { PublicShell } from '@/components/public-shell';
import { ListingPage } from '@/components/inventory/listing-page';

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadPublicSite();
  const metadata = publicMetadata(site, '/inventory', 'Browse the collection', 'Search vehicle records by make, price, year, fuel, transmission and body type. Confirm current availability with the showroom.');
  if (site.mode !== 'supabase') metadata.robots = { index: false, follow: false };
  return metadata;
}

export default async function InventoryPage() {
  const site = await loadPublicSite();
  return <PublicShell route="/inventory" site={site}>
    <Suspense fallback={<div className="band"><div className="wrap"><p>Loading the collection…</p></div></div>}>
      <ListingPage site={site} />
    </Suspense>
  </PublicShell>;
}
