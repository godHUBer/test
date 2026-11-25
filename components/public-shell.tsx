import type { ReactNode } from 'react';
import type { PublicSite } from '@/lib/inventory/server';
import { SiteNavigation,SiteFooter } from './site-chrome';
import { SiteEnhancements } from './site-enhancements';
import { SourceNotice } from './inventory/shared';
export function PublicShell({route,site,children}:{route:string;site:PublicSite;children:ReactNode}){
  return <div data-page={route==='/'?'home':route.startsWith('/cars/')?'inventory':route.slice(1)} data-nav={route==='/'?'overlay':undefined}>
    <SiteNavigation route={route} site={site}/><SourceNotice site={site}/>{children}<SiteFooter site={site}/><SiteEnhancements/>
  </div>;
}
