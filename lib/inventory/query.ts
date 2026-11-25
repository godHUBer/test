import type { Vehicle } from './model';
import { gearbox } from './transmission';
import { href } from '@/lib/deploy';
export type QueryInput = Record<string, string | string[] | undefined>;
export const PAGE_SIZE = 12;
export const budgets = {
  '0-3': { label: 'Under ₹3 Lakh', min: 0, max: 300000 },
  '3-5': { label: '₹3 – under 5 Lakh', min: 300000, max: 500000 },
  '5-8': { label: '₹5 – under 8 Lakh', min: 500000, max: 800000 },
  '8-99': { label: '₹8 Lakh and above', min: 800000, max: Infinity },
  '0-5': { label: 'Under ₹5 Lakh', min: 0, max: 500000 },
};
export interface Filters { make: string; body: string; fuel: string; trans: string; year: string; budget: string; sort: string; q: string; page: number }
export function parseFilters(input: QueryInput): Filters {
  const value = (key: string) => typeof input[key] === 'string' && input[key].length <= 80 ? input[key].trim() : '';
  const filter = (key: string) => value(key) === 'all' ? '' : value(key);
  const year = value('year');
  return {
    make: filter('make'), body: filter('body'), fuel: filter('fuel'), trans: ['Manual','Automatic','unlisted'].includes(filter('trans')) ? filter('trans') : '',
    year: /^\d{4}$/.test(year) && +year >= 1975 && +year <= new Date().getFullYear() + 1 ? year : '',
    budget: Object.hasOwn(budgets, value('budget')) ? value('budget') : '',
    sort: ['price','km','year'].includes(value('sort')) ? value('sort') : 'featured',
    q: value('q').slice(0,60), page: /^\d+$/.test(value('page')) && +value('page') > 0 && +value('page') <= 10000 ? +value('page') : 1,
  };
}
export function filteredVehicles(cars: Vehicle[], f: Filters) {
  const budget = budgets[f.budget as keyof typeof budgets];
  const filtered = cars.filter(c => c.status === 'available' && (!f.make || c.make === f.make) && (!f.body || c.body === f.body)
    && (!f.fuel || c.fuel === f.fuel) && (!f.trans || gearbox(c.transmission) === f.trans) && (!f.year || c.year >= +f.year)
    && (!budget || c.priceRupees >= budget.min && c.priceRupees < budget.max) && (!f.q || c.model.toLocaleLowerCase().includes(f.q.toLocaleLowerCase())));
  return filtered.sort((a,b) => (f.sort === 'price' ? a.priceRupees-b.priceRupees : f.sort === 'km' ? a.km-b.km : f.sort === 'year' ? b.year-a.year : Number(b.featured)-Number(a.featured) || a.sortOrder-b.sortOrder) || a.id.localeCompare(b.id));
}
export function pageOf(cars: Vehicle[], f: Filters) {
  const filtered = filteredVehicles(cars, f);
  const pages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  const page = Math.min(f.page, pages);
  return { vehicles: filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE), total: filtered.length, page, pages };
}
export function filterHref(filters: Filters, changes: Partial<Filters> = {}) {
  const values = { ...filters, ...changes };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value && value !== 'featured' && !(key === 'page' && value === 1)) search.set(key,String(value));
  return href('/inventory') + (search.size ? '?' + search.toString() : '');
}
export function inventoryFacts(cars: Vehicle[]) {
  const available = cars.filter(c => c.status === 'available');
  const distinct = (key: 'make'|'body'|'fuel') => [...new Set(available.map(c => c[key]))].sort();
  return { count: available.length, makes: distinct('make'), bodies: distinct('body'), fuels: distinct('fuel'),
    years: [...new Set(available.map(c=>c.year))].sort((a,b)=>b-a), transmissions: [...new Set(available.map(c=>gearbox(c.transmission)))].sort(),
    min: available.length ? Math.min(...available.map(c=>c.priceRupees)) : null, max: available.length ? Math.max(...available.map(c=>c.priceRupees)) : null,
  };
}
