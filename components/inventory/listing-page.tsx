/* eslint-disable @next/next/no-html-link-for-pages */
import type { PublicSite } from '@/lib/inventory/server';
import type { Filters,pageOf } from '@/lib/inventory/query';
import { filterHref,inventoryFacts } from '@/lib/inventory/query';
import { VehicleCard,EmptyState } from './shared';
import { InventoryFilters } from './filters';
export function ListingPage({site,filters,listing}:{site:PublicSite;filters:Filters;listing:ReturnType<typeof pageOf>|null}){
  const facets=inventoryFacts(site.available);
  return <main id="main"><header className="pagehead band--surface"><div className="wrap"><nav className="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">Browse cars</span></nav><p className="kicker">The collection</p><h1>Find your next car.</h1><p className="lede">Filter by manufacturer, budget, year, fuel, gearbox or body type. A request is not a confirmed booking.</p></div></header>
    <section className="band--sm"><div className="wrap">
      {!listing?<EmptyState title="We could not load the inventory"><p>This is a data-read error, not an empty collection. <a href={filterHref(filters)}>Try again</a> or call <a href={`tel:${site.brand.phoneHref}`}>{site.brand.phoneDisplay}</a>.</p></EmptyState>:<>
        <InventoryFilters filters={filters} facets={facets}/>
        <div className="results" role="status" aria-live="polite"><p><b data-count>{listing.total}</b> matching {site.mode==='snapshot'?'preview records':'available listings'} · page {listing.page} of {listing.pages}</p><a className="link-btn" data-clear href="/inventory">Clear all filters</a></div>
        <div className="veh-grid veh-grid--3">{listing.vehicles.map(car=><VehicleCard key={car.id} car={car} snapshot={site.mode==='snapshot'}/>)}</div>
        {!listing.total&&<EmptyState title={site.available.length?'Nothing matches those filters':'No available vehicles are published'}><p>{site.available.length?'Try clearing a filter or adjusting your budget.':'Reserved and sold cars are not shown as available stock. Contact the showroom for other vehicles.'} <a href="/inventory">Clear filters</a>.</p></EmptyState>}
        <nav className="pagination" aria-label="Inventory pages">{listing.page>1&&<a className="btn btn--line" rel="prev" href={filterHref(filters,{page:listing.page-1})}>Previous</a>}<span>Page {listing.page} of {listing.pages}</span>{listing.page<listing.pages&&<a className="btn btn--line" rel="next" href={filterHref(filters,{page:listing.page+1})}>Next</a>}</nav>
        <div className="inventory-foot"><div><p className="kicker">Reading a listing</p><h2 style={{fontSize:'var(--s3)'}}>Known facts.<br/>Honest gaps.</h2></div><div><p>Unknown specifications remain “not stated”. Vehicle year is shown as recorded, not inferred as a registration or manufacture year. Prices are asking prices, not a valuation or guarantee.</p><p>Fuel types in available records: {facets.fuels.join(' · ')||'None published'}.</p></div></div>
      </>}
    </div></section>
  </main>;
}
