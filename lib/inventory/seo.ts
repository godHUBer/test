import type { Metadata } from 'next';
import { vehicleName, type Vehicle } from './model';
import type { PublicSite } from './server';
import { siteBase, siteUrl } from '@/lib/deploy';

export function publicMetadata(site: PublicSite, route: string, title: string, description: string): Metadata {
  const base = siteBase();
  const index = site.mode === 'supabase' && !!base;
  return {
    title: `${title} | ${site.brand.name}`,
    description,
    robots: { index, follow: index },
    alternates: base ? { canonical: siteUrl(route)! } : undefined,
    openGraph: {
      title, description, type: 'website', siteName: site.brand.name,
      ...(base ? { url: siteUrl(route)!, ...(route === '/' ? { images: [{ url: siteUrl('/assets/img/hero-vehicle.jpg')!, alt: 'Archive dealership forecourt photograph' }] } : {}) } : {}),
    },
  };
}

export function vehicleSchema(car: Vehicle, base: string) {
  return {
    '@context': 'https://schema.org', '@type': 'Car', name: vehicleName(car), brand: { '@type': 'Brand', name: car.make }, model: car.model,
    vehicleTransmission: car.transmission ?? undefined, fuelType: car.fuel || undefined, description: car.overview,
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: car.km, unitCode: 'KMT' }, url: new URL(`/cars/${car.id}`, base).href,
    image: car.images.length ? car.images.map((image) => new URL(image, base).href) : undefined,
    offers: { '@type': 'Offer', price: car.priceRupees, priceCurrency: 'INR', availability: `https://schema.org/${car.status === 'available' ? 'InStock' : car.status === 'sold' ? 'SoldOut' : 'OutOfStock'}` },
  };
}

export function serialiseSchema(value: unknown) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}
