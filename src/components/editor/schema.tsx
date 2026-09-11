'use client';
import {nativeTextColor,nativeBackgroundColor} from './colors';
import type {EditorBlock} from '../../editor/document';
import {createContext,useContext} from 'react';
import {BlockNoteSchema,defaultBlockSpecs,defaultInlineContentSpecs,defaultStyleSpecs,createCodeBlockSpec} from '@blocknote/core';
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
  const names={image:'图片',video:'影片',audio:'音频',file:'文件',table:'表格',hint:'提示框',code:'代码框',tabs:'分页标签',math:'数学公式',diagram:'流程图'};
  return <div className="editor-embedded" contentEditable={false}><strong>{names[media.type]}</strong>{invalid&&<p role="alert">此内容块尚未符合保存要求，请修正下方输入。</p>}<details><summary>编辑此内容块</summary><fieldset disabled={context.frozen}><MediaFields block={media} assets={context.assets} onChange={next=>editor.updateBlock(block,{props:{payload:JSON.stringify(next)}})}/></fieldset></details>
   {!invalid&&<details><summary>查看此块预览</summary><MediaBlocks blocks={[media]} documentId={context.documentId} admin/></details>}
   <div className="media-toolbar"><button type="button" disabled={context.frozen} onClick={()=>editor.moveBlocksUp(block)}>上移内容块</button><button type="button" disabled={context.frozen} onClick={()=>editor.moveBlocksDown(block)}>下移内容块</button><button type="button" disabled={context.frozen} onClick={()=>editor.removeBlocks([block])}>删除内容块</button></div>
  </div>;
 },
 toExternalHTML:({block})=><p>{block.props.payload}</p>,
});
export function createEditorSchema(nodes:EditorBlock[]=[]){
 const supportedLanguages:Record<string,{name:string}>={text:{name:'纯文本'},javascript:{name:'JavaScript'},typescript:{name:'TypeScript'},json:{name:'JSON'},html:{name:'HTML'},css:{name:'CSS'},python:{name:'Python'},sql:{name:'SQL'},bash:{name:'Shell'},yaml:{name:'YAML'},markdown:{name:'Markdown'}};
 const visit=(nodes:EditorBlock[])=>{for(const node of nodes){if(node.type==='codeBlock'&&node.props.language&&!supportedLanguages[node.props.language])supportedLanguages[node.props.language]={name:node.props.language};visit(node.children);}};visit(nodes);
 return BlockNoteSchema.create({
 blockSpecs:{...defaultBlockSpecs,codeBlock:createCodeBlockSpec({supportedLanguages}),juyu:juyu()},
 inlineContentSpecs:defaultInlineContentSpecs,
 styleSpecs:{...defaultStyleSpecs,textColor:nativeTextColor,backgroundColor:nativeBackgroundColor},
});
}
export const editorSchema=createEditorSchema();
export function editorSnapshot(nodes:typeof editorSchema.BlockNoteEditor.document):unknown[]{
 return nodes.map(node=>node.type==='juyu'?{id:node.id,type:'juyu',props:{payload:JSON.stringify({...JSON.parse(node.props.payload),id:node.id})},children:editorSnapshot(node.children)}:{...node,children:editorSnapshot(node.children)});
}
