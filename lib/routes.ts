import inventory from '../assets/data/inventory.json';

export const generalRoutes = [
  { source: 'index.html', route: '/' },
  { source: 'inventory.html', route: '/inventory' },
  { source: 'sell-your-car.html', route: '/sell-your-car' },
  { source: 'about.html', route: '/about' },
  { source: 'showroom.html', route: '/showroom' },
  { source: 'contact.html', route: '/contact' },
  { source: 'legal.html', route: '/legal' },
];
export const siteRoutes = [
  ...generalRoutes,
  ...inventory.cars.map(car => ({ source: `car-${car.id}.html`, route: `/cars/${car.id}` })),
];
export const legacyRedirects = siteRoutes.map(({ source, route }) => ({
  source: `/${source}`, destination: route, permanent: true,
}));
