import type {EditorBlock} from '../editor/document';

/** A stored blank paragraph is an authored line, including inside nested content. */
export function isBlankParagraph(block:EditorBlock):boolean{
 return block.type==='paragraph'
  &&block.content.every(item=>item.type==='text'&&!item.text.trim()&&!/[\r\n]/.test(item.text));
}

/** Used only to distinguish readable content from empty callout/accordion placeholders. */
export function isEmptyPublishedParagraph(block:EditorBlock):boolean{
 return block.type==='paragraph'&&block.children.length===0
  &&block.content.every(item=>item.type==='text'&&!item.text.trim());
}
