import {parseReaderBody,type ReaderDocument} from '../reader/body.ts';
import type {EditorBlock} from '../editor/document.ts';
/** Several answers can be open at once; their heading anchors must not collide. */
export function answerDocument(body:string,id:string):ReaderDocument{
 const document=parseReaderBody(body),prefix='qa-'+encodeURIComponent(id)+'-';
 const visit=(blocks:EditorBlock[]):EditorBlock[]=>blocks.map(block=>({...block,id:prefix+block.id,children:visit(block.children)}));
 return {...document,sections:document.sections.map(section=>({...section,id:prefix+section.id})),blocks:document.blocks.map(block=>block.type==='heading'?{...block,id:prefix+block.id}:block),...(document.editorBlocks?{editorBlocks:visit(document.editorBlocks)}:{})};
}
