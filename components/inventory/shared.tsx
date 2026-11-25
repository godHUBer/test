import type { ReactNode } from 'react';
import type { PublicSite } from '@/lib/inventory/server';
import { formatPrice, vehicleName, type Vehicle } from '@/lib/inventory/model';
import { VehicleImage } from './vehicle-image';
import { href } from '@/lib/deploy';
export function Arrow(){ return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M1 8h13M9.5 3l5 5-5 5"/></svg>; }
export function SourceNotice({site}:{site:PublicSite}){
  return <div className={`source-notice ${site.mode==='error'?'source-notice--error':''}`} role={site.mode==='error'?'alert':'note'}>
    <div className="wrap">{site.mode==='snapshot'?<><strong>Snapshot preview — not live availability.</strong> Vehicle details and asking prices come from the legacy record dated {site.brand.verifiedOn}. Contact the showroom before relying on them.</>:site.mode==='error'?<><strong>Inventory is temporarily unavailable.</strong> We could not read the public database. This is not a “no stock” result; no cached cars are substituted. Contact the showroom using the legacy contact details below.</>:<><strong>Dealership inventory.</strong> These records are read from the public database on request. Confirm availability, condition and asking price with the showroom before travelling.</>}</div>
  </div>;
}
export function EmptyState({title,children}:{title:string;children:ReactNode}) {return <div className="notes" data-empty><h2 style={{fontSize:'var(--s3)'}}>{title}</h2><div>{children}</div></div>;}
export function VehicleCard({car,snapshot=false}:{car:Vehicle;snapshot?:boolean}){
  return <article className="veh" data-card>
    <div className="veh__media"><VehicleImage src={car.cover} alt={`${vehicleName(car)} ${car.variant}`} width={900} height={675}/><span className="veh__price tnum">{formatPrice(car.priceRupees)}</span></div>
    <div className="veh__body"><div><h3 className="veh__title"><a href={href(`/cars/${car.id}`)}>{vehicleName(car)}</a></h3><p className="veh__variant">{car.variant} · {car.reg || 'Registration region not stated'}</p></div>
      <dl className="veh__specs"><div><dt>Year</dt><dd>{car.year}</dd></div><div><dt>Odometer</dt><dd>{car.km.toLocaleString('en-IN')} km</dd></div><div><dt>Fuel</dt><dd>{car.fuel || 'Not stated'}</dd></div><div><dt>Gearbox</dt><dd>{car.transmission || <span className="to-confirm">Not stated</span>}</dd></div></dl>
      <div className="veh__foot"><span className="veh__status">{snapshot?'Preview record':car.status==='available'?'Listed as available':car.status==='reserved'?'Reserved':'Sold'}</span><a className="tlink" href={href(`/cars/${car.id}`)}>View details <Arrow/></a></div>
    </div>
  </article>;
}
export function FeaturedCar({car,snapshot}:{car:Vehicle;snapshot:boolean}) {
  return <article className="veh-hero"><a className="veh-hero__media" href={href(`/cars/${car.id}`)} aria-label={`View ${vehicleName(car)}`}><VehicleImage src={car.cover} alt={`${vehicleName(car)} ${car.variant}`} width={900} height={675} eager/></a>
    <div className="veh-hero__body"><p className="kicker">Featured listing{snapshot?' · snapshot preview':''}</p><h3 className="veh-hero__title">{vehicleName(car)}<br/><em>{car.variant}</em></h3>
      <div className="price-lg tnum">{formatPrice(car.priceRupees)}<small>Asking price — confirm with the showroom</small></div>
      <dl className="veh-hero__specs"><div><dt>Year as recorded</dt><dd>{car.year}</dd></div><div><dt>Odometer</dt><dd>{car.km.toLocaleString('en-IN')} km</dd></div><div><dt>Fuel</dt><dd>{car.fuel || 'Not stated'}</dd></div><div><dt>Transmission</dt><dd>{car.transmission || 'Not stated'}</dd></div></dl>
      <div className="badge-row">{car.highlights.map((h,i)=><span className="tag" key={i}>{h}</span>)}</div>
      <a className="btn btn--solid" href={href(`/cars/${car.id}`)}>View this car <Arrow/></a>
    </div></article>;
}
