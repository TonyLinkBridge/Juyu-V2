import {readerIconKey,type ReaderIconKey} from '../reader/icon-keys.ts';

export type InlineEmbed={type:'icon';icon:ReaderIconKey}|{type:'math';source:string}|{type:'image';assetId:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const base64=(text:string)=>btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function inlineEmbedHref(embed:InlineEmbed):string{
 if(embed.type==='icon'){
  if(!readerIconKey(embed.icon))throw new Error('INVALID_INLINE_EMBED');
  return `#juyu-icon-${embed.icon}`;
 }
 if(embed.type==='image'){
  if(!uuid.test(embed.assetId))throw new Error('INVALID_INLINE_EMBED');
  return `#juyu-image-${embed.assetId}`;
 }
 if(!embed.source.trim()||embed.source.length>350||new TextEncoder().encode(embed.source).length>1200)throw new Error('INVALID_INLINE_EMBED');
 return `#juyu-math-${base64(embed.source)}`;
}
export function inlineEmbed(href:string):InlineEmbed|null{
 if(href.startsWith('#juyu-icon-')){const icon=readerIconKey(href.slice(11));return icon?{type:'icon',icon}:null;}
 if(href.startsWith('#juyu-image-')){const assetId=href.slice(12);return uuid.test(assetId)?{type:'image',assetId}:null;}
 if(href.startsWith('#juyu-math-')){
  const token=href.slice(11);if(!token||token.length>1600||!/^[A-Za-z0-9_-]+$/.test(token))return null;
  try{const bytes=Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')),item=>item.charCodeAt(0));const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);return inlineEmbedHref({type:'math',source})===href?{type:'math',source}:null;}catch{return null;}
 }
 return null;
}
export const reservedInlineEmbed=(href:string)=>/^#juyu-(?:icon|image|math)-/.test(href);
