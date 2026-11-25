/* eslint-disable @next/next/no-html-link-for-pages */
import type { PublicSite } from '@/lib/inventory/server';
import { formatPrice,formatKm,vehicleName,type Vehicle } from '@/lib/inventory/model';
import { VehicleGallery } from './gallery';
import { VehicleCard } from './shared';
import { VehicleEnquiry } from './enquiry';
export function VehicleDetail({car,site}:{car:Vehicle;site:PublicSite}){
  const snapshot=site.mode==='snapshot';const sold=car.status==='sold';const related=site.available.filter(c=>c.id!==car.id).sort((a,b)=>Number(b.body===car.body)-Number(a.body===car.body)||Math.abs(a.priceRupees-car.priceRupees)-Math.abs(b.priceRupees-car.priceRupees)).slice(0,3);
  const specs=[['Year as recorded',String(car.year)],['Variant',car.variant],['Odometer',formatKm(car.km)],['Fuel',car.fuel],['Transmission',car.transmission],['Body type',car.body],['Registration region',car.reg],['Location',car.location]];
  return <main id="main"><header className="pagehead band--surface"><div className="wrap"><nav className="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/inventory">Browse cars</a><span>/</span><span aria-current="page">{vehicleName(car)}</span></nav><div className="car-head"><div><p className="kicker">{snapshot?'Snapshot record':car.status==='available'?'Listed as available':car.status==='reserved'?'Reserved — not available for booking':'Sold — no longer available'}</p><h1>{vehicleName(car)}</h1><p className="car-head__variant">{car.variant}</p></div><div className="car-head__price"><span className="price-lg tnum">{formatPrice(car.priceRupees)}<small>{sold?'Last recorded asking price — not sale price':'Asking price; confirm before relying on it'}</small></span>{car.priceNote&&<p>{car.priceNote}</p>}</div></div></div></header>
    {sold&&<section className="band--sm"><div className="wrap notes"><h2>This car has been sold.</h2><p>This page is retained for reference. It is excluded from active stock and cannot be booked here. <a href="/inventory">Browse available alternatives</a>.</p></div></section>}
    {car.status==='reserved'&&<section className="band--sm"><div className="wrap notes"><h2>This car is reserved.</h2><p>No viewing or reservation is confirmed online. Contact the showroom for an availability update or browse alternatives.</p></div></section>}
    <VehicleGallery images={car.images} name={vehicleName(car)}/>
    <section className="band"><div className="wrap grid car-body-grid"><div className="car-body-main"><div className="block"><h2 style={{fontSize:'var(--s3)'}}>Specifications</h2><dl className="spec-table tnum">{specs.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||<span className="to-confirm">Not stated</span>}</dd></div>)}</dl><p className="small dim">Unknown values are not inferred from a model name. Confirm the manufacture and registration years with the actual documents.</p></div>
      <div className="block"><p className="kicker">Dealer’s overview</p><p className="lede">{car.overview||'No overview has been published.'}</p><p className="small dim">As supplied for this listing. Comparisons with other stock may be dated; confirm current details.</p></div>
      {!!car.highlights.length&&<div className="block"><p className="kicker">Dealer-supplied notes</p><div className="badge-row">{car.highlights.map((h,i)=><span className="tag" key={i}>{h}</span>)}</div><p className="small dim">Seller descriptions are not independent inspection findings or guarantees.</p></div>}
      <div className="block"><p className="kicker">Documents and history</p><p>Ask for the registration certificate, ownership sequence, insurance, PUC and available service records. No warranty, inspection certificate or finance approval is implied.</p></div>
      <div className="block"><p className="kicker">Record provenance</p><p className="small">{snapshot?`Legacy snapshot dated ${site.brand.verifiedOn}; availability has not been reverified.`:car.updatedAt?`Record updated ${new Date(car.updatedAt).toISOString().slice(0,10)}. An edit timestamp is not a vehicle inspection or verification date.`:'No per-vehicle update timestamp is published.'} Reference: {car.id}.</p>{car.listingUrl&&<a href={car.listingUrl} target="_blank" rel="noopener noreferrer">Original external listing</a>}</div>
    </div><aside><div className="aside-card"><p className="aside-price">{formatPrice(car.priceRupees)}</p><p>{snapshot?'Availability unverified in this preview':car.status==='available'?'Listed as available':car.status==='reserved'?'Reserved':'Sold'}</p>
      {!sold&&car.status==='available'&&<a className="btn btn--solid btn--block" href="#enquire">Enquire About This Car</a>}
      {!sold&&car.status==='available'&&<a className="btn btn--line btn--block" href="#enquire" data-prefill-viewing="This week">Request a showroom viewing</a>}
      <a className="btn btn--line btn--block" href="/inventory">Browse the collection</a>
    </div></aside></div></section>
    {!sold&&car.status==='available'&&<VehicleEnquiry car={car} brand={site.brand}/>}
    {!!related.length&&<section className="band"><div className="wrap"><h2>Available alternatives</h2><p>Selected by body type and asking price{snapshot?' within this unverified snapshot':''}.</p><div className="veh-grid veh-grid--3">{related.map(c=><VehicleCard key={c.id} car={c} snapshot={snapshot}/>)}</div></div></section>}
  </main>;
}
