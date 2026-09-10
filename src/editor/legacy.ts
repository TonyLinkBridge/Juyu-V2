import {normalizeBlocks,type MediaBlock} from '../media/model.ts';
import {inlineTokens} from '../reader/inline.ts';
import {parseReaderBody} from '../reader/body.ts';
import {decodeEditorBody,normalizeEditorBlocks,type EditorBlock,type EditorInline} from './document.ts';
// BlockNote requires at least one initial block, including when a saved document contains [].
const emptyParagraph=():EditorBlock[]=>normalizeEditorBlocks([{id:'empty-paragraph',type:'paragraph',props:{},content:[],children:[]}]);
/** Reuse only the previously supported reader subset; fences and unknown syntax remain literal text. */
export function editorInitialContent(body:string,media:MediaBlock[]):EditorBlock[]{
 const existing=decodeEditorBody(body);if(existing!==null)return existing.length?existing:emptyParagraph();
 const normalizedMedia=normalizeBlocks(media);const used=new Set(normalizedMedia.map(block=>block.id));let serial=0;
 const id=(preferred?:string)=>{if(preferred&&!used.has(preferred)){used.add(preferred);return preferred;}let candidate;do{candidate=`legacy-${++serial}`;}while(used.has(candidate));used.add(candidate);return candidate;};
 const props={textAlignment:'left' as const,textColor:'default' as const,backgroundColor:'default' as const};
 const literal=(text:string):EditorInline[]=>{const chunks:EditorInline[]=[];for(let offset=0;offset<text.length;offset+=50000)chunks.push({type:'text',text:text.slice(offset,offset+50000),styles:{}});return chunks;};
 const content=(text:string):EditorInline[]=>inlineTokens(text).flatMap(token=>{
  const styles=token.type==='strong'?{bold:true}:token.type==='em'?{italic:true}:token.type==='code'?{code:true}:{};
  const chunks:EditorInline[]=[];for(let offset=0;offset<token.text.length;offset+=50000)chunks.push({type:'text',text:token.text.slice(offset,offset+50000),styles});return chunks;
 });
 const custom=(block:MediaBlock):EditorBlock=>({id:block.id,type:'juyu',props:{payload:JSON.stringify(block)},children:[]});
 const blocks:EditorBlock[]=[];const allMedia=[...normalizedMedia];
 for(const block of parseReaderBody(body).blocks){
  if(block.type==='list'&&block.ordered&&block.start<1){blocks.push({id:id(),type:'paragraph',props,content:literal(block.items.map((item,index)=>`${block.start+index}. ${item}`).join('\n')),children:[]});}
  else if(block.type==='list'){for(const [index,item] of block.items.entries())blocks.push({id:id(),type:block.ordered?'numberedListItem':'bulletListItem',props:{...props,...(block.ordered?{start:block.start+index}:{})},content:content(item),children:[]});}
  else if(block.type==='table'){
   const table={id:id(),type:'table' as const,headers:block.headers,rows:block.rows};
   // Historical pipe tables had no size cap. Keep oversized tables as literal text instead of dropping cells.
   try{normalizeBlocks([...allMedia,table]);allMedia.push(table);blocks.push(custom(table));}catch{blocks.push({id:table.id,type:'paragraph',props,content:literal(['| '+block.headers.join(' | ')+' |','| '+block.headers.map(()=>'---').join(' | ')+' |',...block.rows.map(row=>'| '+row.join(' | ')+' |')].join('\n')),children:[]});}
  }else blocks.push({id:id(block.type==='heading'?block.id:undefined),type:block.type,props:{...props,...(block.type==='heading'?{level:block.depth}:{})},content:content(block.text),children:[]});
 }
 blocks.push(...normalizedMedia.map(custom));return blocks.length?normalizeEditorBlocks(blocks):emptyParagraph();
}
