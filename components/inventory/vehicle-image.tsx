'use client';
/* eslint-disable @next/next/no-img-element -- preserves known public image URLs without an external optimiser */
import { useState } from 'react';
export function VehicleImage({src,alt,width=900,height=675,eager=false,className,ariaHidden}:{src:string|null;alt:string;width?:number;height?:number;eager?:boolean;className?:string;ariaHidden?:boolean}){
  const [failedSource,setFailedSource]=useState<string|null>(null);
  if(!src || failedSource===src) return <div className={['image-unavailable',className].filter(Boolean).join(' ')} aria-hidden={ariaHidden} role="img" aria-label={`${alt} — photograph unavailable`}>Photograph unavailable</div>;
  return <img aria-hidden={ariaHidden} className={className} src={src} alt={alt} width={width} height={height} loading={eager?'eager':'lazy'} decoding="async" onError={()=>setFailedSource(src)}/>;
}
