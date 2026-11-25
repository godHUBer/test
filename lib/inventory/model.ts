import inventory from '../../assets/data/inventory.json';
import { lakhToRupees } from '../format';

export type PublicStatus = 'available' | 'reserved' | 'sold';
export interface Vehicle {
  id: string; year: number; make: string; model: string; variant: string; km: number;
  fuel: string; transmission: string | null; body: string; priceRupees: number; priceNote: string | null;
  reg: string; location: string; highlights: string[]; overview: string; listingUrl: string | null;
  status: PublicStatus; featured: boolean; sortOrder: number; cover: string | null; images: string[];
  updatedAt: string | null;
}
export interface Brand {
  name: string; tagline: string; established: string; ledBy: string; phoneDisplay: string; phoneHref: string;
  email: string; addressShort: string; addressCity: string; area: string; mapUrl: string;
  services: string[]; hours: string | null; verifiedOn: string; sourceInventory: string; sourceSite: string;
}
export const snapshotBrand: Brand = { ...inventory.brand };
export const PUBLIC_CAR_COLUMNS = 'id,year,make,model,variant,km,fuel,transmission,body,price_lakh,price_note,reg,location,highlights,overview,listing_url,status,featured,sort_order,photo_stock,photos_gallery,updated_at';
export const PUBLIC_BRAND_COLUMNS = 'name,tagline,phone_display,phone_href,email,address_short,address_city,area,map_url,services,hours,verified_on';
export const validSlug = (id: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length <= 120;
export const vehicleName = (car: Vehicle) => `${car.year} ${car.make} ${car.model}`;
export const formatPrice = (rupees: number) => `₹ ${(rupees / 100000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 5 })} Lakh`;
export const formatKm = (km: number) => `${km.toLocaleString('en-IN')} km`;
export const gearbox = (value: string | null) => value?.split(' ')[0] ?? 'unlisted';
export function absoluteOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash ? url.origin : null; } catch { return null; }
}
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function publicImage(value: unknown, projectOrigin?: string): string | null {
  if (typeof value !== 'string' || !value || value.length > 2000) return null;
  const local = value.startsWith('assets/') ? '/' + value : value;
  if (/^\/assets\/img\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(local)) return local;
  if (!projectOrigin) return null;
  if (value.startsWith('https://')) {
    const url = safeUrl(value);
    if (!url) return null;
    const parsed = new URL(url);
    return parsed.origin === projectOrigin && parsed.pathname.startsWith('/storage/v1/object/public/car-photos/') && !parsed.search ? url : null;
  }
  const path = value.replace(/^car-photos\//, '');
  if (path.split('/').some(part => !part || part === '.' || part === '..') || !/^[\w/ .-]+\.(jpg|jpeg|png|webp)$/i.test(path)) return null;
  return `${projectOrigin}/storage/v1/object/public/car-photos/${path.split('/').map(encodeURIComponent).join('/')}`;
}
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const nullableText = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;
const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
export function parseVehicle(row: unknown, projectOrigin?: string): Vehicle {
  if (!row || typeof row !== 'object') throw new Error('Invalid public vehicle');
  const r = row as Record<string, unknown>;
  if (!validSlug(text(r.id)) || !['available','reserved','sold'].includes(text(r.status))) throw new Error('Invalid public identity/status');
  for (const field of ['year','km']) if (typeof r[field] !== 'number' || !Number.isSafeInteger(r[field]) || (r[field] as number) < 0) throw new Error('Invalid vehicle number');
  if ((r.year as number) < 1975 || (r.year as number) > 2100 || !text(r.make).trim() || !text(r.model).trim()) throw new Error('Incomplete vehicle identity');
  const priceRupees = lakhToRupees(String(r.price_lakh));
  if (!priceRupees) throw new Error('Invalid asking price');
  const cover = publicImage(r.photo_stock, projectOrigin);
  const images = [...new Set([cover, ...strings(r.photos_gallery).map(path => publicImage(path, projectOrigin))].filter((v): v is string => !!v))];
  return {
    id: text(r.id), year: r.year as number, km: r.km as number, make: text(r.make), model: text(r.model), variant: text(r.variant),
    fuel: text(r.fuel), transmission: nullableText(r.transmission), body: text(r.body), priceRupees, priceNote: nullableText(r.price_note),
    reg: text(r.reg), location: text(r.location), highlights: strings(r.highlights), overview: text(r.overview), listingUrl: safeUrl(r.listing_url),
    status: r.status as PublicStatus, featured: r.featured === true, sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 100,
    cover, images, updatedAt: nullableText(r.updated_at) && Number.isFinite(Date.parse(String(r.updated_at))) ? String(r.updated_at) : null,
  };
}
export function parseBrand(row: unknown): Brand {
  if (!row || typeof row !== 'object') throw new Error('Missing public company settings');
  const r = row as Record<string, unknown>;
  return {
    ...snapshotBrand,
    name: text(r.name, snapshotBrand.name), tagline: text(r.tagline, snapshotBrand.tagline),
    phoneDisplay: text(r.phone_display, snapshotBrand.phoneDisplay), phoneHref: /^\+?[0-9 ]{6,20}$/.test(text(r.phone_href)) ? text(r.phone_href).replaceAll(' ', '') : snapshotBrand.phoneHref,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(r.email)) ? text(r.email) : snapshotBrand.email,
    addressShort: text(r.address_short, snapshotBrand.addressShort), addressCity: text(r.address_city, snapshotBrand.addressCity), area: text(r.area, snapshotBrand.area),
    mapUrl: safeUrl(r.map_url) ?? snapshotBrand.mapUrl, services: Array.isArray(r.services) ? strings(r.services) : snapshotBrand.services,
    hours: nullableText(r.hours), verifiedOn: /^\d{4}-\d{2}-\d{2}$/.test(text(r.verified_on)) ? text(r.verified_on) : snapshotBrand.verifiedOn,
  };
}
export const snapshotVehicles: Vehicle[] = inventory.cars.map((car, index) => parseVehicle({
  ...car, price_lakh: car.priceLakh, price_note: car.priceNote, listing_url: car.listingUrl,
  status: 'available', sort_order: index, featured: 'featured' in car && car.featured,
  photo_stock: `assets/img/stock/${car.id}.jpg`, photos_gallery: [1,2].map(i => `assets/img/gallery/${car.id}-${i}.jpg`),
}));
