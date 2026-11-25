/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- shared public document navigation and original artwork */
import type { PublicSite } from '@/lib/inventory/server';
import { snapshotBrand } from '@/lib/inventory/model';
import { Arrow } from './inventory/shared';
const navigation=[['Home','/'],['Browse cars','/inventory'],['Sell your car','/sell-your-car'],['About us','/about'],['Our showroom','/showroom'],['Contact','/contact'],['Services','/services']];
export function SiteNavigation({route,site}:{route:string;site?:PublicSite}){
  const brand=site?.brand??snapshotBrand;
  const active=route.startsWith('/cars/')?'/inventory':route;
  const count=site?.mode==='error'?'Inventory unavailable':`${site?.available.length??0} ${site?.mode==='snapshot'?'preview records':'available listings'}`;
  return <><a className="skip" href="#main">Skip to content</a><nav className={`nav${route==='/'?' nav--overlay':''}`} aria-label="Main"><div className="wrap nav__inner">
    <a className="brand" href="/"><img className="brand__logo" src="/assets/img/logo.png" width={400} height={168} alt={brand.name} fetchPriority="high"/></a>
    <div className="nav__links"><ul>{navigation.map(([title,href])=><li key={href}><a href={href} aria-current={href===active?'page':undefined}>{title}</a></li>)}</ul></div>
    <a className="btn btn--solid btn--sm nav__cta" href="/inventory">Explore Inventory <Arrow/></a><button type="button" className="nav__toggle" data-sheet-open aria-controls="sheet" aria-expanded="false"><i aria-hidden="true"/>Menu</button>
  </div></nav>
    <div className="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="Site menu"><div className="sheet__top"><img className="sheet__logo" src="/assets/img/logo.png" width={400} height={168} alt={brand.name}/><button type="button" className="sheet__close" data-sheet-close>Close</button></div>
      <ol>{navigation.map(([title,href],i)=><li key={href}><a href={href}><span>{String(i+1).padStart(2,'0')}</span>{title}</a></li>)}</ol>
      <div className="sheet__meta"><p className="sheet__meta-h">The showroom</p><p>{brand.addressShort}, {brand.addressCity}<br/><a href={brand.mapUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a> · <a href={`mailto:${brand.email}`}>{brand.email}</a></p><p className="sheet__meta-note">{count} · contact the showroom to confirm stock</p></div>
      <div className="sheet__foot"><a className="btn btn--bright" href="/inventory">Explore Inventory <Arrow/></a><a className="btn btn--line-dark" href={`tel:${brand.phoneHref}`}>Call {brand.phoneDisplay}</a></div>
    </div></>;
}
export function SiteFooter({site}:{site?:PublicSite}){
  const b=site?.brand??snapshotBrand;
  return <footer className="foot"><div className="wrap"><div className="foot__grid">
    <div><img className="foot__logo" src="/assets/img/logo.png" width={400} height={168} alt={b.name} loading="lazy"/><p className="foot__tag">{b.tagline}</p><p className="foot__note">A multi-brand new and used car dealership in Kolkata since {b.established}. {b.services.join(' · ')}.</p><p className="small dim">No verified ratings or certifications are implied.</p></div>
    <div><h4>The collection</h4><ul><li><a href="/inventory">Browse available listings</a></li>{['SUV','Sedan','Hatchback','MUV'].map(body=><li key={body}><a href={`/inventory?body=${body}`}>{body==='MUV'?'MUVs':body+'s'}</a></li>)}<li><a href="/inventory?budget=0-5">Under ₹5 Lakh</a></li><li><a href="/inventory?fuel=Diesel">Diesel</a></li></ul></div>
    <div><h4>Dealership</h4><ul>{[['Our story','/about'],['Our showroom','/showroom'],['Sell your car','/sell-your-car'],['Contact','/contact'],['Services','/services'],['Send an enquiry','/contact#enquiry'],['Privacy policy','/legal'],['Terms and conditions','/legal#terms']].map(([label,href])=><li key={href}><a href={href}>{label}</a></li>)}</ul></div>
    <div><h4>The showroom</h4><ul><li className="contact-line"><b><a href={`tel:${b.phoneHref}`}>{b.phoneDisplay}</a></b></li><li className="contact-line"><b><a href={`mailto:${b.email}`}>{b.email}</a></b></li><li className="contact-line"><b><a href={b.mapUrl} target="_blank" rel="noopener noreferrer">{b.addressShort}</a></b><span>{b.addressCity}</span></li><li className="contact-line"><b>{b.hours || 'Opening hours to be confirmed by the dealership'}</b></li></ul></div>
  </div><div className="foot__bar"><span>© {new Date().getFullYear()} {b.name}. {site?.mode==='snapshot'?'Snapshot preview; availability unverified.':'Asking prices and availability must be confirmed.'}</span><ul><li><a href="/legal">Privacy</a></li><li><a href="/legal#terms">Terms</a></li><li><a href="/legal#data">Listing data</a></li></ul></div></div></footer>;
}
