import {intakeConfig} from '@/lib/business/config';
import {PublicIntake} from '@/components/business/public-intake';
import parse,{Element,Text,type DOMNode,type HTMLReactParserOptions} from 'html-react-parser';
import {Fragment,type ReactNode} from 'react';
import type {PublicSite} from '@/lib/inventory/server';
import {editorialTemplates} from '@/lib/editorial';
import {inventoryFacts} from '@/lib/inventory/query';
import {formatPrice,formatKm,vehicleName,type Brand} from '@/lib/inventory/model';
import {FeaturedCar,VehicleCard,EmptyState} from '@/components/inventory/shared';
import {VehicleImage} from '@/components/inventory/vehicle-image';
import { href, asset } from '@/lib/deploy';

const gaps:Record<string,string>={
  warranty:'The dealership does not publish a warranty programme', inspection:'No standard independent inspection certificate is published',
  finance:'Finance and insurance terms, rates and approval are set by their providers; no approval is implied',
  valuation:'No instant online valuation is offered; discuss a price after inspection',testdrive:'Home test-drive availability must be confirmed for the specific car',
  social:'No confirmed social media channel is published',
};
function textContent(node:DOMNode):string {return node instanceof Text?node.data:node instanceof Element?(node.children as DOMNode[]).map(textContent).join(''):'';}
function Placeholder({label,note}:{label:string;note:string}){return <div className="ph" role="img" aria-label={`${label}: ${note}`}><div className="ph__in"><b>{label}</b><span>{note}</span></div></div>;}
function ContactGrid({brand:b}:{brand:Brand}){return <dl className="contact-grid"><div><dt>Telephone</dt><dd><a href={`tel:${b.phoneHref}`}>{b.phoneDisplay}</a></dd></div><div><dt>Email</dt><dd><a href={`mailto:${b.email}`}>{b.email}</a></dd></div><div><dt>Showroom</dt><dd><a href={b.mapUrl} target="_blank" rel="noopener noreferrer">{b.addressShort}</a><small>{b.addressCity}</small></dd></div><div><dt>Hours</dt><dd>{b.hours||'Opening hours to be confirmed by the dealership'}</dd></div><div><dt>Services</dt><dd>{b.services.join(' · ')||'Contact the showroom for confirmed services'}</dd></div><div><dt>Established</dt><dd>{b.established}</dd></div></dl>;}
export function EditorialPage({route,site}:{route:string;site:PublicSite}){
  const template=editorialTemplates()[route];
  if(!template)throw new Error('Editorial route missing');
  const configured=!!intakeConfig(),intake=site.mode==='supabase'&&configured;
  const b=site.brand;const cars=site.available;const facts=inventoryFacts(cars);
  const ordered=cars.slice().sort((a,c)=>Number(c.featured)-Number(a.featured)||a.sortOrder-c.sortOrder||a.id.localeCompare(c.id));
  const featured=ordered[0];const preview=site.mode==='snapshot';
  const values:Record<string,string>={BRAND:b.name,PHONE:b.phoneDisplay,PHONE_HREF:b.phoneHref,EMAIL:b.email,ADDRESS:b.addressShort,ADDRESS_CITY:b.addressCity,AREA:b.area,MAP_URL:b.mapUrl,YEAR:b.established,LEAD:b.ledBy,VERIFIED:b.verifiedOn,PUBLISHED:site.mode==='error'?'unavailable':String(cars.length),FLOOR:'not a managed count',PRICE_MIN:facts.min===null?'No asking prices':formatPrice(facts.min),PRICE_MAX:facts.max===null?'No asking prices':formatPrice(facts.max),MAKES:facts.makes.join(', ')||'No makes published',SERVICE_LIST:b.services.join(' · '),SOURCE_INVENTORY:b.sourceInventory,SOURCE_SITE:b.sourceSite};
  const stockUnavailable=()=> <EmptyState title={site.mode==='error'?'Inventory is temporarily unavailable':'No available listings are published'}><p>{site.mode==='error'?'A data-read error is not a no-stock result.':'Please ask the showroom about forthcoming vehicles.'} <a href={`tel:${b.phoneHref}`}>Call {b.phoneDisplay}</a>.</p></EmptyState>;
  const shots=(arg:string)=>{
    const selection=(arg==='STORY'?ordered.slice(1,4):ordered.slice(0,4));
    return selection.length?<>{selection.map((car,i)=><figure className={`shot${i===0?' shot--wide':''}`} key={car.id}><VehicleImage src={car.cover} alt={`${vehicleName(car)} listing photograph`}/><figcaption>{vehicleName(car)} · {formatKm(car.km)} · {formatPrice(car.priceRupees)}{preview?' · snapshot':''}</figcaption></figure>)}</>:<Placeholder label="Listing photographs" note="No available vehicle photographs can be shown."/>;
  };
  function resolveToken(token:string):ReactNode {
    if(Object.hasOwn(values,token))return values[token];
    if(token==='HERO_IMAGE'||token.startsWith('IMG:'))return <VehicleImage src={asset("/assets/img/hero-vehicle.jpg")} alt="Archive photograph from the dealership forecourt; not a current stock listing" width={1680} height={940} eager={token==='HERO_IMAGE'}/>;
    if(token==='CONTACT_GRID')return <ContactGrid brand={b}/>;
    if(token==='CAR_CARDS:FEATURED')return featured?<FeaturedCar car={featured} snapshot={preview}/>:stockUnavailable();
    if(token==='CAR_CARDS:GRID')return <>{ordered.filter(c=>c.id!==featured?.id).slice(0,6).map(c=><VehicleCard key={c.id} car={c} snapshot={preview}/>)}</>;
    if(token.startsWith('SHOTS:'))return shots(token.slice(6));
    if(token.startsWith('CAR_OPTIONS'))return <><option value="">Which car? (optional)</option>{cars.map(c=><option key={c.id} value={`${vehicleName(c)} ${c.variant} (ref ${c.id})`}>{vehicleName(c)} — {c.variant} · {formatPrice(c.priceRupees)}</option>)}</>;
    if(token.startsWith('PH:')){const key=token.slice(3);return key==='hours'?(b.hours||'Opening hours to be confirmed by the dealership'):gaps[key]??'Not confirmed by the dealership';}
    if(token.startsWith('PLACEHOLDER:')){const [label,note='Photograph not published']=token.slice(12).replace(/:dark$/,'').split('|');return <Placeholder label={label} note={note}/>;}
    throw new Error(`Unsupported editorial token: ${token}`);
  }
  const options:HTMLReactParserOptions={replace(node){
    if(node instanceof Text && node.data.includes('{{')){
      return <>{node.data.split(/(\{\{[^}]+\}\})/g).map((part,i)=><Fragment key={i}>{part.startsWith('{{')?resolveToken(part.slice(2,-2)):part}</Fragment>)}</>;
    }
    if(!(node instanceof Element))return;
    // Data is substituted into React text/props, never interpolated into HTML markup.
    for(const [key,value] of Object.entries(node.attribs)){
      if(value.includes('{{'))node.attribs[key]=value.replace(/\{\{([^}]+)\}\}/g,(_,token:string)=>{
        if(!Object.hasOwn(values,token))throw new Error(`Unsupported attribute token: ${token}`);return values[token];
      });
    }
    for(const [k,v] of Object.entries(node.attribs)){if((k==='href'||k==='src')&&v.startsWith('/')&&!v.startsWith('//'))node.attribs[k]=href(v);}
    const cls=node.attribs.class??'';const content=textContent(node);
    if(intake&&node.name==='form'&&node.attribs['data-mailto']&&(route==='/contact'||route==='/sell-your-car'))return <PublicIntake source={route==='/contact'?'contact':'sell'} kind={route==='/contact'?'general':'sell'} cars={cars.map(c=>({id:c.id,label:vehicleName(c)}))}/>;
    if(intake&&route!=='/legal'&&node.name==='p'&&(content.includes('compose an email')||content.includes('composes an email')||content.includes('mail app')||content.includes('nothing is stored')||content.includes('do not transmit data')))return <p>Enabled online forms store your contact details, request and consent notice version for authorised dealership staff to respond. A stored reference is shown only after a confirmed database write. Requests are not confirmed appointments and no automatic notification is promised. Phone/email remain alternatives.</p>;
    if(route==='/legal'&&node.name==='p'&&content.includes('Public browsing runs no analytics'))return <p>Public browsing uses no advertising or analytics cookies. Listing photographs may be loaded from the dealership’s Supabase storage provider. Staff authentication uses essential secure cookies.</p>;
    if(configured&&route==='/legal'&&node.name==='p'&&content.includes('do not transmit data'))return <><p>Enabled online forms store your name, phone, optional email, question, vehicle/service details and the accepted contact notice version. Authorised managers and assigned staff use these records to handle your request. Keyed contact and, where a trusted network integration is enabled, network hashes are used for abuse limits. No customer account, marketing subscription, tracking pixel or automatic email/SMS notification is created.</p><p>Request records and private staff follow-up notes are retained for dealership operations until the owner applies an approved retention or removal procedure; automated expiry is not enabled. For access, correction or a removal request, contact <a href={`mailto:${b.email}`}>{b.email}</a> and provide your stored reference. The dealership must review retention, legal grounds and this notice before enabling intake for real customers. Do not submit identity documents, financial credentials or other sensitive documents.</p></>;


    if(cls==='hero__credit')return <p className="hero__credit">Archive forecourt photograph · browse listings for current records</p>;
    if(cls.includes('hero__foot'))return <div className="hero__foot tnum"><span>{site.mode==='error'?'Inventory unavailable':`${cars.length} ${preview?'preview records':'available listings'}`}</span><span>Since {b.established}</span><span>{b.area}</span><a href={`tel:${b.phoneHref}`}>{b.phoneDisplay}</a></div>;
    if(cls==='collection-foot')return <div className="collection-foot"><dl className="mini-facts tnum"><div><dt>{preview?'Preview records':'Available listings'}</dt><dd>{site.mode==='error'?'Unavailable':cars.length}</dd></div><div><dt>Asking price range</dt><dd>{facts.min===null?'Not published':`${formatPrice(facts.min)} – ${formatPrice(facts.max!)}`}</dd></div><div><dt>Brands</dt><dd>{facts.makes.join(', ')||'Not published'}</dd></div></dl><div className="notes"><h4>Before you travel</h4><p>Call to confirm the car, price, documents and a viewing time. The total physical forecourt stock is not inferred from public listings.</p></div></div>;
    if(cls==='why-split__media')return <div className="why-split__media"><VehicleImage src={asset("/assets/img/hero-vehicle.jpg")} alt="Archive dealership forecourt photograph"/><span className="why-split__cap">Archive dealership photograph — not a statement of current stock</span></div>;
    if(node.name==='p'&&content.includes('{{FLOOR}}'))return <p>The public collection shows {site.mode==='error'?'an inventory read error':`${cars.length} ${preview?'snapshot records':'available records'}`}. Physical forecourt stock may differ. Phone the showroom to confirm availability; there is no managed total-floor count yet.</p>;
    if(node.name==='li'&&content.includes('Specifications')&&content.includes('{{VERIFIED}}'))return <li><b>Specifications</b> come from dealership records. Unknown values are labelled, and a record edit is not an inspection.</li>;
    if(node.name==='p'&&content.includes('Every specification, photograph and price on this site is taken'))return <p>{preview?`This preview uses the legacy listing snapshot dated ${b.verifiedOn}.`:'Vehicle records are read from the dealership database on request.'} Source URLs on individual listings are provenance links, not a guarantee that an external directory remains current.</p>;
    if(node.name==='p'&&content.includes('Listing data is regenerated'))return <p>For corrections contact <a href={`mailto:${b.email}`}>{b.email}</a> with the listing reference. In live mode public stock, prices and selections are read from the dealership database. No corrections are submitted by this page.</p>;
    if(node.name==='p'&&content.includes('seven')&&content.includes('completeness'))return <p>Unstated specifications remain unknown rather than being inferred from a model name. Ask for actual vehicle documents before relying on year, condition or ownership details.</p>;
    if(node.name==='form'&&node.attribs['data-mailto']){node.attribs.action=`mailto:${b.email}`;node.attribs.method='post';node.attribs.enctype='text/plain';}
    if(node.name==='input'&&node.attribs.id==='s-year')node.attribs.max=String(new Date().getFullYear());
    if(node.name==='select'&&node.attribs.id==='q-car'&&!cars.length)node.attribs.disabled='';
  }};
  return <>{parse(template,options)}</>;
}
