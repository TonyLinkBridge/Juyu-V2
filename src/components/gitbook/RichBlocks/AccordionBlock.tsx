import {Accordion,Accordions} from 'fumadocs-ui/components/accordion';
import {isEmptyPublishedParagraph} from '../../../fumadocs/paragraphs';
import type {TextBlock} from '../../../media/model';
import {decodeTabBody} from '../../../media/tab-body';
import {StructuredDocument} from '../Reading/StructuredDocument';

export function AccordionBlock({block,documentId,revision,admin=false,locale='zh-CN'}:{block:Extract<TextBlock,{type:'accordion'}>;documentId?:string;revision?:number;admin?:boolean;locale?:'zh-CN'|'en'}){
 const items=block.items.filter(item=>{
  if(item.title.trim())return true;
  const rich=decodeTabBody(item.body);
  return rich?rich.some(child=>!isEmptyPublishedParagraph(child)):Boolean(item.body.trim());
 });
 if(!items.length)return null;
 return <div data-fumadocs-accordion={block.id}><Accordions type="single">{items.map((item,index)=>{
  const title=item.title||(locale==='en'?`Question ${index+1}`:`问题 ${index+1}`),body=decodeTabBody(item.body),id=`${block.id}-${item.id}`;
  return <Accordion key={item.id} id={id} value={id} title={title}>{body?<StructuredDocument blocks={body} documentId={documentId} revision={revision} admin={admin} locale={locale}/>:item.body?<p>{item.body}</p>:null}</Accordion>;
 })}</Accordions></div>;
}
