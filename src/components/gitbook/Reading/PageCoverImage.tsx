'use client';
// Adapted from GitBook PageCoverImage: aspect ratio, crop position and native image.
import {useRef,useEffect,useState} from 'react';
import type {ArticleCover} from '../../../domain/presentation';
export function PageCoverImage({cover}:{cover:ArticleCover}) {
 const [failed,setFailed]=useState(false);
 const ref=useRef<HTMLImageElement>(null);
 useEffect(()=>{
   // A private image can fail before hydration attaches the error handler.
   const image=ref.current;
   if(image?.complete && image.naturalWidth===0)image.dispatchEvent(new Event('error'));
 },[]);
 if(failed)return <div className="reader-cover-unavailable"><span>封面暂时无法加载</span></div>;
 // Native request carries the session to our private endpoint. The Next image
 // optimizer does not forward authentication headers and must not cache this file.
 // eslint-disable-next-line @next/next/no-img-element
 return <img ref={ref} src={`/api/assets/${cover.assetId}`} alt={cover.alt} width="1990" height="480" fetchPriority="high" referrerPolicy="same-origin" className="reader-cover-image" style={{objectPosition:`50% ${cover.position}%`}} onError={()=>setFailed(true)}/>;
}
