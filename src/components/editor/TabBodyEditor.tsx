'use client';
import {useEffect,useRef,useState} from 'react';
import {BlockNoteSchema,defaultBlockSpecs,defaultInlineContentSpecs,defaultStyleSpecs} from '@blocknote/core';
import {en,zh} from '@blocknote/core/locales';
import {useCreateBlockNote} from '@blocknote/react';
import {BlockNoteView} from '@blocknote/mantine';
import {nativeTextColor,nativeBackgroundColor} from './colors';
import {decodeTabBody,encodeTabBody} from '../../media/tab-body';
import {safeLink} from '../../editor/inline';
import type {ManagedAsset} from '../../media/model';

const schema=BlockNoteSchema.create({
 blockSpecs:{paragraph:defaultBlockSpecs.paragraph,heading:defaultBlockSpecs.heading,bulletListItem:defaultBlockSpecs.bulletListItem,numberedListItem:defaultBlockSpecs.numberedListItem,checkListItem:defaultBlockSpecs.checkListItem,toggleListItem:defaultBlockSpecs.toggleListItem,quote:defaultBlockSpecs.quote,codeBlock:defaultBlockSpecs.codeBlock,table:defaultBlockSpecs.table,divider:defaultBlockSpecs.divider,image:defaultBlockSpecs.image},
 inlineContentSpecs:defaultInlineContentSpecs,
 styleSpecs:{...defaultStyleSpecs,textColor:nativeTextColor,backgroundColor:nativeBackgroundColor},
});

export function TabBodyEditor({value,frozen,onChange,assets=[],locale='zh-CN'}:{value:string;frozen:boolean;onChange:(value:string)=>void;assets?:ManagedAsset[];locale?:'zh-CN'|'en'}){
 const [error,setError]=useState('');
 const [selected,setSelected]=useState('');
 const ready=useRef(false);
 const initial=useRef(value);
 const editor=useCreateBlockNote({schema,dictionary:locale==='en'?en:zh,domAttributes:{editor:{'aria-label':locale==='en'?'Rich text content':'内嵌排版内容'}},links:{isValidLink:safeLink},initialContent:[{type:'paragraph',content:''}],resolveFileUrl:async(url)=>url.replace(/^\/api\/assets\//,'/api/admin/assets/')},[]);
 useEffect(()=>{const content=(decodeTabBody(initial.current)??[{type:'paragraph',content:initial.current}]) as typeof schema.PartialBlock[];editor.replaceBlocks(editor.document,content);ready.current=true;},[editor]);
 return <div className="rich-tab-body-editor">{assets.some(asset=>asset.status==='ready'&&asset.mime.startsWith('image/'))&&<div className="media-toolbar"><select aria-label={locale==='en'?'Choose an image':'选择内嵌图片'} disabled={frozen} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">{locale==='en'?'Choose an image uploaded to this article':'选择本篇已上传的图片'}</option>{assets.filter(asset=>asset.status==='ready'&&asset.mime.startsWith('image/')).map(asset=><option key={asset.id} value={asset.id}>{asset.filename}</option>)}</select><button type="button" disabled={frozen||!selected} onClick={()=>{const asset=assets.find(item=>item.id===selected);if(!asset)return;editor.insertBlocks([{type:'image',props:{url:`/api/assets/${asset.id}`,name:asset.filename}}],editor.getTextCursorPosition().block,'after');}}>{locale==='en'?'Insert image':'插入图片'}</button></div>}<BlockNoteView editor={editor} editable={!frozen} onChange={()=>{if(!ready.current)return;try{const next=encodeTabBody(editor.document);setError('');onChange(next);}catch{setError(locale==='en'?'This section is too long or contains unsupported blocks. Shorten it or remove the unsupported content, then save again.':'内嵌内容太长，或包含尚不支持的内容块。请缩短或移除后再保存。');}}}/>{error&&<p role="alert">{error}</p>}</div>;
}
