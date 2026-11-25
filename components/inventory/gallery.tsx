'use client';
import { useRef,useState,useEffect } from 'react';
import { VehicleImage } from './vehicle-image';
export function VehicleGallery({images,name}:{images:string[];name:string}){
  const [index,setIndex]=useState(0);const [open,setOpen]=useState(false);const dialog=useRef<HTMLDialogElement>(null);const zoom=useRef<HTMLButtonElement>(null);
  const move=(step:number)=>setIndex(value=>(value+step+images.length)%images.length);
  useEffect(()=>{
    if(open){
      // Wait for React to apply the visible class before invoking native modal focus.
      if(dialog.current&&!dialog.current.open)dialog.current.showModal();
      dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
      document.body.classList.add('is-locked');
    }else{dialog.current?.close();document.body.classList.remove('is-locked');}
    return()=>document.body.classList.remove('is-locked');
  },[open]);
  const close=()=>{dialog.current?.close();setOpen(false);zoom.current?.focus();};
  if(!images.length)return <div className="wrap band--sm"><div className="image-unavailable" role="img" aria-label="Photographs unavailable">No photographs have been published for this vehicle.</div></div>;
  return <section className="band--sm gallery-band" aria-label="Vehicle photographs"><div className="wrap"><div className="gallery" data-gallery onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key==='ArrowRight'){e.preventDefault();move(1);}}}>
    <div className="gallery__stage">{images.map((src,i)=><VehicleImage key={src} src={src} alt={`${name}, view ${i+1} of ${images.length}`} width={1400} height={1050} className={index===i?'is-shown':''} ariaHidden={index!==i} eager={i===0}/>)}
      {images.length>1&&<><button className="gallery__nav gallery__nav--prev" type="button" data-gallery-prev onClick={()=>move(-1)} aria-label="Previous photograph">←</button><button className="gallery__nav gallery__nav--next" type="button" data-gallery-next onClick={()=>move(1)} aria-label="Next photograph">→</button></>}
      <span className="gallery__counter" data-gallery-count aria-live="polite">{index+1} / {images.length}</span><button ref={zoom} className="gallery__zoom" type="button" data-lightbox-open onClick={()=>setOpen(true)}>Enlarge</button>
    </div><div className="gallery__thumbs" role="group" aria-label="Choose a photograph">{images.map((src,i)=><button key={src} type="button" data-thumb aria-current={index===i?'true':'false'} aria-label={`Show photograph ${i+1}`} onClick={()=>setIndex(i)}><VehicleImage src={src} alt="" width={240} height={180}/></button>)}</div>
  </div><p className="small dim gallery-note">{images.length} photographs published. These images are not an independent inspection report.</p></div>
    <dialog ref={dialog} className={`lightbox${open?' is-open':''}`} data-lightbox aria-label="Photograph viewer" onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key==='ArrowRight'){e.preventDefault();move(1);}}} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
      <button className="lightbox__close" type="button" data-lightbox-close onClick={close} aria-label="Close viewer">×</button><VehicleImage src={images[index]} alt={`${name}, view ${index+1}`} width={1400} height={1050} eager/>
      <p className="lightbox__cap">{name} · {index+1} / {images.length}</p>
    </dialog>
  </section>;
}
