'use client';
/* eslint-disable @next/next/no-img-element -- editor assets use the private, session-protected endpoint. */
import {nativeTextColor,nativeBackgroundColor} from './colors';
import type {EditorBlock} from '../../editor/document';
import {createContext,useContext} from 'react';
import {BlockNoteSchema,defaultBlockSpecs,defaultInlineContentSpecs,defaultStyleSpecs,createCodeBlockSpec} from '@blocknote/core';
import {createReactBlockSpec,createReactInlineContentSpec} from '@blocknote/react';
import {fromCanvasBlocks} from '../../editor/inline-canvas';
import {readerIconKey} from '../../reader/icon-keys';
import {ReaderIcon} from '../../reader/icons';
import {mathMarkup} from '../../science/model';
import {normalizeBlocks,type ManagedAsset,type MediaBlock} from '../../media/model';
import {MediaFields} from './MediaFields';
import {MediaBlocks} from '../gitbook/Media/MediaBlocks';
export const EditorContext=createContext<{documentId:string;assets:ManagedAsset[];frozen:boolean;locale:'zh-CN'|'en'}>({documentId:'',assets:[],frozen:false,locale:'zh-CN'});
const juyuInline=createReactInlineContentSpec({type:'juyuInline',propSchema:{kind:{default:'icon',values:['icon','math','image'] as const},value:{default:''},label:{default:''}},content:'none'}, {
 render:({inlineContent})=>{
  const {kind,value,label}=inlineContent.props;
  if(kind==='icon'){const icon=readerIconKey(value);return <span className="inline-reader-icon" role="img" aria-label={label||'图标'} contentEditable={false}>{icon?<ReaderIcon icon={icon} size={17} className=""/>:'◇'}</span>;}
  if(kind==='math'){let html='';try{html=mathMarkup(value,false);}catch{return <code contentEditable={false}>{value}</code>;}return <span className="inline-reader-math" aria-label={value} contentEditable={false} dangerouslySetInnerHTML={{__html:html}}/>;}
  return <img className="inline-reader-image" src={`/api/admin/assets/${encodeURIComponent(value)}`} alt={label||'行内图片'} contentEditable={false} loading="lazy"/>;
 },
 toExternalHTML:({inlineContent})=><span>{inlineContent.props.label||inlineContent.props.value}</span>,
});
const juyu=createReactBlockSpec({type:'juyu',propSchema:{payload:{default:''}},content:'none'}, {
 render:function EmbeddedBlock({block,editor}){
  const context=useContext(EditorContext);let invalid=false;
  const t=(zh:string,en:string)=>context.locale==='en'?en:zh;
  let payload:Record<string,unknown>;
  try{payload=JSON.parse(block.props.payload) as Record<string,unknown>;}catch{return <div role="alert">{t('内容块无法读取。','This block could not be read.')}<button type="button" disabled={context.frozen} onClick={()=>editor.removeBlocks([block])}>{t('删除内容块','Delete block')}</button></div>;}
  if(payload.type==='reusableContent')return <div className="editor-embedded" data-juyu-type="reusableContent" contentEditable={false}><strong>{t('共用片段','Reusable snippet')} · {String(payload.title)} · {t(`第 ${String(payload.version)} 版`,`Version ${String(payload.version)}`)}</strong><p className="editor-embedded-note">{t('下方是已插入本文的内容副本。更新片段请使用顶部「共用片段」，保存后仍需审核。','Below is a copy inserted into this article. Use Reusable snippets above to adopt a newer version. Your changes still need review.')}</p><div className="media-toolbar"><button type="button" disabled={context.frozen} onClick={()=>editor.moveBlocksUp(block)}>{t('上移片段','Move up')}</button><button type="button" disabled={context.frozen} onClick={()=>editor.moveBlocksDown(block)}>{t('下移片段','Move down')}</button><button type="button" disabled={context.frozen} onClick={()=>editor.removeBlocks([block])}>{t('删除片段','Delete snippet')}</button></div></div>;
  const media={...payload,id:block.id} as MediaBlock;
  try{normalizeBlocks([media]);}catch{invalid=true;}
  const names=context.locale==='en'?{image:'Image',video:'Video',audio:'Audio',file:'File',table:'Table',hint:'Callout',code:'Code',tabs:'Tabs',steps:'Steps',columns:'Columns',articleReference:'Article card',button:'Button',externalEmbed:'External content',math:'Equation',diagram:'Diagram'}:{image:'图片',video:'影片',audio:'音频',file:'文件',table:'表格',hint:'提示框',code:'代码框',tabs:'分页标签',steps:'操作步骤',columns:'分栏布局',articleReference:'引用文章',button:'操作按钮',externalEmbed:'外部内容',math:'数学公式',diagram:'流程图'};
  return <div className="editor-embedded" data-juyu-type={media.type} data-juyu-style={media.type==='hint'?media.style:undefined} contentEditable={false}><strong>{names[media.type]}</strong>{invalid&&<p role="alert">{t('此内容块尚未符合保存要求，请修正下方输入。','This block is not ready to save. Check the fields below.')}</p>}<details><summary>{t('编辑此内容块','Edit this block')}</summary><fieldset disabled={context.frozen}><MediaFields block={media} assets={context.assets} documentId={context.documentId} frozen={context.frozen} locale={context.locale} onChange={next=>editor.updateBlock(block,{props:{payload:JSON.stringify(next)}})}/></fieldset></details>
   {!invalid&&(media.type==='hint'?<p className="editor-embedded-note">{t('完整提示框请使用顶部的「预览草稿」查看。','Use Preview draft above to see the full callout.')}</p>:<details><summary>{t('查看此块预览','Preview this block')}</summary><MediaBlocks blocks={[media]} documentId={context.documentId} locale={context.locale} admin/></details>)}
   <div className="media-toolbar">{media.type==='hint'&&<button type="button" disabled={context.frozen} onClick={()=>editor.updateBlock(block,{children:[...block.children,{type:'paragraph',content:''}] as never})}>{t('在提示框中添加段落','Add a paragraph to the callout')}</button>}<button type="button" disabled={context.frozen} onClick={()=>editor.moveBlocksUp(block)}>{t('上移内容块','Move block up')}</button><button type="button" disabled={context.frozen} onClick={()=>editor.moveBlocksDown(block)}>{t('下移内容块','Move block down')}</button><button type="button" disabled={context.frozen} onClick={()=>editor.removeBlocks([block])}>{t('删除内容块','Delete block')}</button></div>
  </div>;
 },
 toExternalHTML:({block})=><p>{block.props.payload}</p>,
});
export function createEditorSchema(nodes:EditorBlock[]=[]){
 const supportedLanguages:Record<string,{name:string}>={text:{name:'纯文本'},javascript:{name:'JavaScript'},typescript:{name:'TypeScript'},json:{name:'JSON'},html:{name:'HTML'},css:{name:'CSS'},python:{name:'Python'},sql:{name:'SQL'},bash:{name:'Shell'},yaml:{name:'YAML'},markdown:{name:'Markdown'}};
 const visit=(nodes:EditorBlock[])=>{for(const node of nodes){if(node.type==='codeBlock'&&node.props.language&&!supportedLanguages[node.props.language])supportedLanguages[node.props.language]={name:node.props.language};visit(node.children);}};visit(nodes);
 return BlockNoteSchema.create({
 blockSpecs:{...defaultBlockSpecs,codeBlock:createCodeBlockSpec({supportedLanguages}),juyu:juyu()},
 inlineContentSpecs:{...defaultInlineContentSpecs,juyuInline},
 styleSpecs:{...defaultStyleSpecs,textColor:nativeTextColor,backgroundColor:nativeBackgroundColor},
});
}
export const editorSchema=createEditorSchema();
export function editorSnapshot(nodes:typeof editorSchema.BlockNoteEditor.document):unknown[]{
 return fromCanvasBlocks(nodes.map(node=>node.type==='juyu'?{id:node.id,type:'juyu',props:{payload:JSON.stringify({...JSON.parse(node.props.payload),id:node.id})},children:editorSnapshot(node.children)}:{...node,children:editorSnapshot(node.children)}));
}
