import type {EditorBlock} from '../editor/document';

export function isEmptyPublishedParagraph(block:EditorBlock):boolean{
 return block.type==='paragraph'
  &&block.children.length===0
  &&block.content.every(item=>item.type==='text'&&!item.text.trim());
}

export function withoutEmptyPublishedParagraphs(nodes:EditorBlock[]):EditorBlock[]{
 return nodes.flatMap(block=>{
  if(isEmptyPublishedParagraph(block))return [];
  return [{...block,children:withoutEmptyPublishedParagraphs(block.children)} as EditorBlock];
 });
}
