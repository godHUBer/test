'use client';
import type { Filters } from '@/lib/inventory/query';
import { budgets,filterHref } from '@/lib/inventory/query';
interface Facets { makes:string[];bodies:string[];fuels:string[];years:number[];transmissions:string[] }
export function InventoryFilters({filters:f,facets}:{filters:Filters;facets:Facets}){
  const select=(name:keyof Filters,label:string,values:{value:string;label:string}[])=> <div className="field"><label htmlFor={`f-${name}`}>{label}</label><select id={`f-${name}`} name={name} defaultValue={String(f[name])} onChange={e=>e.currentTarget.form?.requestSubmit()}><option value="">Any {label.toLowerCase()}</option>{f[name] && !values.some(v=>v.value===String(f[name])) && <option value={String(f[name])}>{String(f[name])} (no current records)</option>}{values.map(v=><option key={v.value} value={v.value}>{v.label}</option>)}</select></div>;
  return <form className="filters" action="/inventory" method="get" aria-label="Filter and sort the collection">
    {select('make','Manufacturer',facets.makes.map(v=>({value:v,label:v})))}
    {select('budget','Budget',Object.entries(budgets).map(([value,b])=>({value,label:b.label})))}
    {select('year','Year from',facets.years.map(v=>({value:String(v),label:String(v)})))}
    {select('fuel','Fuel',facets.fuels.map(v=>({value:v,label:v})))}
    {select('trans','Gearbox',facets.transmissions.map(v=>({value:v,label:v==='unlisted'?'Not stated':v})))}
    <div className="field"><label htmlFor="f-sort">Sort by</label><select id="f-sort" name="sort" defaultValue={f.sort} onChange={e=>e.currentTarget.form?.requestSubmit()}><option value="featured">Featured order</option><option value="price">Price — low to high</option><option value="km">Odometer — low to high</option><option value="year">Year — newest first</option></select></div>
    <div className="field"><label htmlFor="f-q">Model search</label><input id="f-q" name="q" type="text" maxLength={60} defaultValue={f.q}/></div>
    <input type="hidden" name="body" value={f.body}/><button type="submit" className="btn btn--solid">Apply filters</button>
    <div className="field form__full"><span className="legend">Body type</span><div className="chips" role="group" aria-label="Body type"><a className="chip" href={filterHref(f,{body:'',page:1})} aria-current={!f.body?'true':undefined}>All body types</a>{facets.bodies.map(body=><a className="chip" key={body} href={filterHref(f,{body,page:1})} aria-current={f.body===body?'true':undefined}>{body}</a>)}</div></div>
  </form>;
}
