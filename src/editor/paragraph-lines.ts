import {createExtension,defaultBlockSpecs} from '@blocknote/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import {isBlankParagraph} from '../fumadocs/paragraphs';
import type {EditorBlock} from './document';

// Presentation-only decorations follow document changes without changing saved
// block props or content. A soft break in real text is never an empty paragraph.
const paragraphLines=createExtension({key:'juyu-paragraph-lines',prosemirrorPlugins:[new Plugin({
 key:new PluginKey('juyuParagraphLines'),
 props:{decorations(state){
  const decorations:Decoration[]=[];
  state.doc.descendants((node,position)=>{
   if(node.type.name!=='paragraph')return;
   let blank=true;
   node.forEach(child=>{if(!child.isText||child.text?.trim()||child.marks.some(mark=>mark.type.name==='link'))blank=false;});
   if(blank)decorations.push(Decoration.node(position,position+node.nodeSize,{'data-reader-empty-paragraph':''}));
  });
  return DecorationSet.create(state.doc,decorations);
 }},
})]});
const nativeParagraph=defaultBlockSpecs.paragraph;
export const paragraphLineSpec={...nativeParagraph,extensions:[...(nativeParagraph.extensions??[]),paragraphLines]};

// Full HTML export does not execute ProseMirror decorations. Apply the same
// presentation marker to the detached export, never to stored article data.
export function exportedParagraphLines(html:string,blocks:EditorBlock[]):string{
 const blankIds=new Set<string>();
 const visit=(nodes:EditorBlock[])=>{for(const block of nodes){if(isBlankParagraph(block))blankIds.add(block.id);visit(block.children);}};
 visit(blocks);
 const root=document.createElement('div');root.innerHTML=html;
 for(const paragraph of root.querySelectorAll<HTMLElement>('.bn-block-content[data-content-type="paragraph"]')){
  const id=paragraph.closest('[data-id]')?.getAttribute('data-id');
  if(id&&blankIds.has(id))paragraph.setAttribute('data-reader-empty-paragraph','');
 }
 return root.innerHTML;
}
