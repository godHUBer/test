import type { Metadata } from 'next';
import { Suspense } from 'react';
import { loadPublicSite } from '@/lib/inventory/server';
import { publicMetadata } from '@/lib/inventory/seo';
import { href } from '@/lib/deploy';
import { PublicShell } from '@/components/public-shell';
import { ListingResults } from '@/components/inventory/listing-page';

export async function generateMetadata(): Promise<Metadata> {
  const site = await loadPublicSite();
  const metadata = publicMetadata(site, '/inventory', 'Browse the collection', 'Search vehicle records by make, price, year, fuel, transmission and body type. Confirm current availability with the showroom.');
  if (site.mode !== 'supabase') metadata.robots = { index: false, follow: false };
  return metadata;
}

export default async function InventoryPage() {
  const site = await loadPublicSite();
  return <PublicShell route="/inventory" site={site}>
    <main id="main">
      <header className="pagehead band--surface"><div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb"><a href={href('/')}>Home</a><span>/</span><span aria-current="page">Browse cars</span></nav>
        <p className="kicker">The collection</p><h1>Find your next car.</h1>
        <p className="lede">Filter by manufacturer, budget, year, fuel, gearbox or body type. A request is not a confirmed booking.</p>
      </div></header>
      <Suspense fallback={<div className="band"><div className="wrap"><p>Loading the collection…</p></div></div>}>
        <ListingResults site={site} />
      </Suspense>
    </main>
  </PublicShell>;
}
