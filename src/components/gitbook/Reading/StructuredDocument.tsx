import {Fragment,type ReactNode} from 'react';
import type {EditorBlock,EditorInline} from '../../../editor/document';
import {MediaBlocks} from '../Media/MediaBlocks';
// JUYU's validated BlockNote snapshot adapter retains the GitBook heading anchors and reading layout.
function StructuredInline({content}:{content:EditorInline[]}){
 return content.map((inline,index)=>{
  let node:ReactNode=inline.text;
  if(inline.styles.code)node=<code>{node}</code>;
  if(inline.styles.bold)node=<strong>{node}</strong>;
  if(inline.styles.italic)node=<em>{node}</em>;
  if(inline.styles.underline)node=<u>{node}</u>;
  if(inline.styles.strike)node=<s>{node}</s>;
  return <Fragment key={index}>{node}</Fragment>;
 });
}
export function StructuredDocument({blocks,documentId,revision,admin=false}:{blocks:EditorBlock[];documentId?:string;revision?:number;admin?:boolean}){
 const render=(nodes:EditorBlock[]):ReactNode[]=>{
  const result:ReactNode[]=[];
  for(let i=0;i<nodes.length;i++){
   const block=nodes[i];
   if(block.type==='juyu'){result.push(<MediaBlocks key={block.id} blocks={[JSON.parse(block.props.payload)]} documentId={documentId} revision={revision} admin={admin}/>);continue;}
   if(block.type==='bulletListItem'||block.type==='numberedListItem'){
    const type=block.type;const items:ReactNode[]=[];
    while(i<nodes.length&&nodes[i].type===type){const item=nodes[i];if(item.type==='juyu')break;items.push(<li key={item.id} value={type==='numberedListItem'?item.props.start:undefined} style={{textAlign:item.props.textAlignment}}><StructuredInline content={item.content}/>{render(item.children)}</li>);i++;}i--;
    result.push(type==='numberedListItem'?<ol key={block.id} start={block.props.start??1}>{items}</ol>:<ul key={block.id}>{items}</ul>);continue;
   }
   const Tag=block.type==='heading'?({1:'h2',2:'h3',3:'h4'} as const)[block.props.level??1]:'p';
   const title=block.content.map(inline=>inline.text).join('');
   result.push(<Fragment key={block.id}><Tag id={block.type==='heading'?block.id:undefined} tabIndex={block.type==='heading'?-1:undefined} className={block.type==='heading'?'heading font-heading block gitbook-heading':undefined} style={{textAlign:block.props.textAlignment}}><StructuredInline content={block.content}/>{block.type==='heading'&&<a href={`#${block.id}`} className="heading-hash" aria-label={`定位到：${title}`}>#</a>}</Tag>{block.children.length>0&&<div style={{paddingInlineStart:'1.5rem'}}>{render(block.children)}</div>}</Fragment>);
  }return result;
 };
 return <>{render(blocks)}</>;
}
