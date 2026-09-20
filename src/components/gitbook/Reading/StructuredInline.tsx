import type {ReactNode,CSSProperties} from 'react';
import {inlineText,screenInlineStyle,type EditorInline} from '../../../editor/inline';
import {annotationText} from '../../../editor/annotation';
import {inlineEmbed} from '../../../editor/inline-embed';
import {ReaderIcon} from '../../../reader/icons';
import {mediaAssetUrl} from '../../../history/paths';
import {mathMarkup} from '../../../science/model';
import {InlineAnnotation} from './InlineAnnotation';
/* eslint-disable @next/next/no-img-element -- session-protected inline assets use the private endpoint. */
export const structuredStyle=(p:{textColor?:string;backgroundColor?:string;textAlignment?:CSSProperties['textAlign']}):CSSProperties=>({...screenInlineStyle(p),textAlign:p.textAlignment} as CSSProperties);
export function StructuredInline({content,documentId,revision,admin=false,locale='zh-CN'}:{content:EditorInline[];documentId?:string;revision?:number;admin?:boolean;locale?:'zh-CN'|'en'}){
 return content.map((inline,index)=>{
  if(inline.type==='link'){
   const note=annotationText(inline.href),embed=inlineEmbed(inline.href);
   if(note)return <InlineAnnotation key={index} note={note}><StructuredInline content={inline.content} documentId={documentId} revision={revision} admin={admin} locale={locale}/></InlineAnnotation>;
   if(embed?.type==='icon')return <span key={index} className="inline-reader-icon" role="img" aria-label={inlineText(inline.content)||(locale==='en'?'Icon':'图标')}><ReaderIcon icon={embed.icon} size={17} className=""/></span>;
   if(embed?.type==='math'){let html='';try{html=mathMarkup(embed.source,false);}catch{return <code key={index}>{embed.source}</code>;}return <span key={index} className="inline-reader-math" aria-label={embed.source} dangerouslySetInnerHTML={{__html:html}}/>;}
   if(embed?.type==='image')return <img key={index} className="inline-reader-image" src={mediaAssetUrl(embed.assetId,admin,documentId,revision)} alt={inlineText(inline.content)||(locale==='en'?'Inline image':'行内图片')} loading="lazy"/>;
   return <a key={index} href={inline.href} rel="noopener noreferrer"><StructuredInline content={inline.content} documentId={documentId} revision={revision} admin={admin} locale={locale}/></a>;
  }
  let node:ReactNode=inline.text;
  if(inline.styles.code)node=<code>{node}</code>;if(inline.styles.bold)node=<strong>{node}</strong>;if(inline.styles.italic)node=<em>{node}</em>;if(inline.styles.underline)node=<u>{node}</u>;if(inline.styles.strike)node=<s>{node}</s>;
  return <span key={index} style={structuredStyle(inline.styles)}>{node}</span>;
 });
}
