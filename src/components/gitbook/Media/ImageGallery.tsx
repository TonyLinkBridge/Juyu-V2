'use client';
/* eslint-disable @next/next/no-img-element -- private files must keep session-bound delivery. */
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {useReaderLocale} from './ArticleReferenceContext';

export interface GalleryImage {id:string;src:string;darkSrc?:string;alt:string;caption?:string;width?:number;alignment?:'left'|'center'|'right'|'justify'}

function blockStyle(item:GalleryImage):CSSProperties|undefined{
 if(!item.alignment)return undefined;
 return {width:item.width??'fit-content',maxWidth:'100%',justifySelf:item.alignment==='center'?'center':item.alignment==='right'?'end':'start'};
}

function useDarkTheme(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{const root=document.documentElement;const update=()=>setDark(root.dataset.theme==='dark');update();const observer=new MutationObserver(update);observer.observe(root,{attributes:true,attributeFilter:['data-theme']});return()=>observer.disconnect();},[]);
 return dark;
}

export function ImageGallery({images}:{images:GalleryImage[]}){
 const english=useReaderLocale()==='en';
 const [active,setActive]=useState<number|null>(null),[failed,setFailed]=useState<string[]>([]),[darkFailed,setDarkFailed]=useState<string[]>([]);
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement[]>([]),dark=useDarkTheme();
 useEffect(()=>{const modal=dialog.current;if(active!==null&&!modal?.open)modal?.showModal();else if(active===null&&modal?.open)modal.close();},[active]);
 function close(){const index=active;setActive(null);if(index!==null)requestAnimationFrame(()=>trigger.current[index]?.focus());}
 const source=(item:GalleryImage)=>dark&&item.darkSrc&&!darkFailed.includes(item.id)?item.darkSrc:item.src;
 const fail=(item:GalleryImage)=>{if(dark&&item.darkSrc&&!darkFailed.includes(item.id))setDarkFailed(old=>[...old,item.id]);else setFailed(old=>old.includes(item.id)?old:[...old,item.id]);};
 return <div className={`reader-image-gallery${images.length>1?' has-multiple':''}`} aria-label={images.length>1?(english?'Image gallery':'图片组'):undefined}>
  {images.map((item,index)=><figure key={item.id} className="reader-gallery-item" style={blockStyle(item)}><button type="button" ref={node=>{if(node)trigger.current[index]=node;}} className="reader-gallery-open" aria-label={english?`View larger image: ${item.alt||`Image ${index+1}`}`:`放大图片：${item.alt||`图片 ${index+1}`}`} onClick={()=>setActive(index)} disabled={failed.includes(item.id)}>{failed.includes(item.id)?<span role="status">{english?'Image unavailable':'图片暂时无法读取'}</span>:<img src={source(item)} alt={item.alt} loading="lazy" style={item.width?{width:item.width,maxWidth:'100%'}:undefined} onError={()=>fail(item)}/>}</button><figcaption>{item.caption&&<p>{item.caption}</p>}<div className="media-file-actions"><a href={source(item)} target="_blank" rel="noopener noreferrer">{english?'Open original':'打开原文件'}</a><a href={`${source(item)}${source(item).includes('?')?'&':'?'}download=1`} download>{english?'Download':'下载文件'}</a></div></figcaption></figure>)}
  <dialog ref={dialog} className="reader-image-dialog" aria-label={english?'Enlarged image':'图片放大查看'} onClose={close} onClick={event=>{if(event.target===dialog.current)close();}} onKeyDown={event=>{if(active===null)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setActive((active+(event.key==='ArrowRight'?1:images.length-1))%images.length);}}}>
   {active!==null&&<div className="reader-image-dialog-inner"><div className="reader-image-dialog-toolbar"><span>{images.length>1?`${active+1} / ${images.length}`:''}</span><button type="button" onClick={close} aria-label={english?'Close image':'关闭图片'}>{english?'Close':'关闭'}</button></div><img src={source(images[active])} alt={images[active].alt} onError={()=>fail(images[active])}/>{images[active].caption&&<p>{images[active].caption}</p>}{images.length>1&&<div className="reader-image-dialog-controls"><button type="button" onClick={()=>setActive((active+images.length-1)%images.length)}>{english?'Previous':'上一张'}</button><button type="button" onClick={()=>setActive((active+1)%images.length)}>{english?'Next':'下一张'}</button></div>}</div>}
  </dialog>
 </div>;
}
