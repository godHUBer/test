import type {Metadata} from 'next';
import {absoluteOrigin,vehicleName,type Vehicle} from './model';
import type {PublicSite} from './server';
export function publicMetadata(site:PublicSite,route:string,title:string,description:string):Metadata{
  const origin=absoluteOrigin(process.env.SITE_URL);
  const index=site.mode==='supabase'&&!!origin;
  return {title:`${title} | ${site.brand.name}`,description,robots:{index,follow:index},alternates:origin?{canonical:new URL(route,origin).href}:undefined,
    openGraph:{title,description,type:'website',siteName:site.brand.name,...(origin?{url:new URL(route,origin).href,...(route==='/'?{images:[{url:new URL('/assets/img/hero-vehicle.jpg',origin).href,alt:'Archive dealership forecourt photograph'}]}:{})}:{})},
  };
}
export function vehicleSchema(car:Vehicle,origin:string){
  return {'@context':'https://schema.org','@type':'Car',name:vehicleName(car),brand:{'@type':'Brand',name:car.make},model:car.model,
    vehicleTransmission:car.transmission??undefined,fuelType:car.fuel||undefined,description:car.overview,
    mileageFromOdometer:{'@type':'QuantitativeValue',value:car.km,unitCode:'KMT'},url:new URL(`/cars/${car.id}`,origin).href,
    image:car.images.length?car.images.map(image=>new URL(image,origin).href):undefined,
    offers:{'@type':'Offer',price:car.priceRupees,priceCurrency:'INR',availability:`https://schema.org/${car.status==='available'?'InStock':car.status==='sold'?'SoldOut':'OutOfStock'}`},
  };
}
export function serialiseSchema(value:unknown){return JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');}
