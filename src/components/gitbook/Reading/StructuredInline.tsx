import type {ReactNode,CSSProperties} from 'react';
import {screenInlineStyle,type EditorInline} from '../../../editor/inline';
export const structuredStyle=(p:{textColor?:string;backgroundColor?:string;textAlignment?:CSSProperties['textAlign']}):CSSProperties=>({...screenInlineStyle(p),textAlign:p.textAlignment} as CSSProperties);
export function StructuredInline({content}:{content:EditorInline[]}){
 return content.map((inline,index)=>{
  if(inline.type==='link')return <a key={index} href={inline.href} rel="noopener noreferrer"><StructuredInline content={inline.content}/></a>;
  let node:ReactNode=inline.text;
  if(inline.styles.code)node=<code>{node}</code>;if(inline.styles.bold)node=<strong>{node}</strong>;if(inline.styles.italic)node=<em>{node}</em>;if(inline.styles.underline)node=<u>{node}</u>;if(inline.styles.strike)node=<s>{node}</s>;
  return <span key={index} style={structuredStyle(inline.styles)}>{node}</span>;
 });
}
