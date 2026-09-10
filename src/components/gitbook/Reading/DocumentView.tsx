import {StructuredDocument} from './StructuredDocument';
import {Inline} from './Inline';
// Adapted from GitBook DocumentView/DocumentView.tsx (GPL-3.0).
// Retain block-list rendering and whitespace; use the verified text adapter.
import type {ReaderDocument} from '../../../reader/body';
import {Heading} from './Heading';
import {Paragraph} from './Paragraph';
export function DocumentView({document,documentId,revision,admin=false}:{document:ReaderDocument;documentId?:string;revision?:number;admin?:boolean}) {
 return <div className="gitbook-document flex flex-col whitespace-pre-wrap" data-content-ref-root="">
   {document.editorBlocks?<StructuredDocument blocks={document.editorBlocks} documentId={documentId} revision={revision} admin={admin}/>:document.blocks.map((block,index)=>{
     switch(block.type) {
       case 'table':return <div className="reader-scroll-region" tabIndex={0} role="region" aria-label="文章表格，可横向滚动" key={`block-${index}`}><table><thead><tr>{block.headers.map((text,i)=><th scope="col" key={i}>{text}</th>)}</tr></thead><tbody>{block.rows.map((row,i)=><tr key={i}>{row.map((text,j)=><td key={j}>{text}</td>)}</tr>)}</tbody></table></div>;
       case 'heading':return <Heading key={block.id} block={block}/>;
       case 'paragraph':return <Paragraph key={`block-${index}`} text={block.text}/>;
       case 'list':return block.ordered
         ?<ol key={`block-${index}`} start={block.start}>{block.items.map((text,i)=><li key={i}>{<Inline text={text}/>}</li>)}</ol>
         :<ul key={`block-${index}`}>{block.items.map((text,i)=><li key={i}>{<Inline text={text}/>}</li>)}</ul>;
     }
   })}
 </div>;
}
