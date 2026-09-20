import type {TextBlock} from '../../../media/model';
import {decodeTabBody} from '../../../media/tab-body';
import {StructuredDocument} from '../Reading/StructuredDocument';
import type {CSSProperties} from 'react';

export function Columns({block,documentId,revision,admin=false,locale='zh-CN'}:{block:Extract<TextBlock,{type:'columns'}>;documentId?:string;revision?:number;admin?:boolean;locale?:'zh-CN'|'en'}){
 return <section className="rich-columns" aria-label={locale==='en'?'Column layout':'分栏内容'} style={{'--reader-column-count':block.columns.length} as CSSProperties}>{block.columns.map((column,index)=><article key={column.id}><h3>{column.title||(locale==='en'?`Column ${index+1}`:`第 ${index+1} 栏`)}</h3>{decodeTabBody(column.body)?<StructuredDocument blocks={decodeTabBody(column.body)!} documentId={documentId} revision={revision} admin={admin} locale={locale}/>:column.body?<p>{column.body}</p>:null}</article>)}</section>;
}
