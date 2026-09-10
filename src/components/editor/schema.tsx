'use client';
import {createContext,useContext} from 'react';
import {BlockNoteSchema,defaultBlockSpecs,defaultInlineContentSpecs,defaultStyleSpecs,createHeadingBlockSpec} from '@blocknote/core';
import {createReactBlockSpec} from '@blocknote/react';
import {normalizeBlocks,type ManagedAsset,type MediaBlock} from '../../media/model';
import {MediaFields} from './MediaFields';
import {MediaBlocks} from '../gitbook/Media/MediaBlocks';
export const EditorContext=createContext<{documentId:string;assets:ManagedAsset[];frozen:boolean}>({documentId:'',assets:[],frozen:false});
const juyu=createReactBlockSpec({type:'juyu',propSchema:{payload:{default:''}},content:'none'}, {
 render:function EmbeddedBlock({block,editor}){
  const context=useContext(EditorContext);let media:MediaBlock;let invalid=false;
  try{media={...JSON.parse(block.props.payload),id:block.id} as MediaBlock;}catch{return <div role="alert">内容块无法读取。<button type="button" disabled={context.frozen} onClick={()=>editor.removeBlocks([block])}>删除内容块</button></div>;}
  try{normalizeBlocks([media]);}catch{invalid=true;}
  const names={image:'图片',video:'影片',file:'文件',table:'表格',hint:'提示框',code:'代码框',tabs:'分页标签',math:'数学公式',diagram:'流程图'};
  return <div className="editor-embedded" contentEditable={false}><strong>{names[media.type]}</strong>{invalid&&<p role="alert">此内容块尚未符合保存要求，请修正下方输入。</p>}<details><summary>编辑此内容块</summary><fieldset disabled={context.frozen}><MediaFields block={media} assets={context.assets} onChange={next=>editor.updateBlock(block,{props:{payload:JSON.stringify(next)}})}/></fieldset></details>
   {!invalid&&<details><summary>查看此块预览</summary><MediaBlocks blocks={[media]} documentId={context.documentId} admin/></details>}
   <div className="media-toolbar"><button type="button" disabled={context.frozen} onClick={()=>editor.moveBlocksUp(block)}>上移内容块</button><button type="button" disabled={context.frozen} onClick={()=>editor.moveBlocksDown(block)}>下移内容块</button><button type="button" disabled={context.frozen} onClick={()=>editor.removeBlocks([block])}>删除内容块</button></div>
  </div>;
 },
 toExternalHTML:({block})=><p>{block.props.payload}</p>,
});
export const editorSchema=BlockNoteSchema.create({
 blockSpecs:{paragraph:defaultBlockSpecs.paragraph,heading:createHeadingBlockSpec({levels:[1,2,3],allowToggleHeadings:false}),bulletListItem:defaultBlockSpecs.bulletListItem,numberedListItem:defaultBlockSpecs.numberedListItem,juyu:juyu()},
 inlineContentSpecs:defaultInlineContentSpecs,
 styleSpecs:{bold:defaultStyleSpecs.bold,italic:defaultStyleSpecs.italic,underline:defaultStyleSpecs.underline,strike:defaultStyleSpecs.strike,code:defaultStyleSpecs.code},
});
// BlockNote can generate a fresh outer id when duplicating a custom block. Keep its media projection in sync.
export function editorSnapshot(nodes:typeof editorSchema.BlockNoteEditor.document):unknown[]{
 return nodes.map(node=>node.type==='juyu'?{id:node.id,type:'juyu',props:{payload:JSON.stringify({...JSON.parse(node.props.payload),id:node.id})},children:editorSnapshot(node.children)}:{...node,props:Object.fromEntries(Object.entries(node.props).filter(([key])=>key!=='isToggleable')),children:editorSnapshot(node.children)});
}
