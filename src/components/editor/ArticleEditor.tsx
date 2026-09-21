'use client';
import {LocalRecovery} from './LocalRecovery';
import {ReusableFragmentDialog} from './ReusableFragmentDialog';
import {createReusableWrapper,refreshReusableWrapper,reusableReferences,reusableAssetIds,type ReusableFragment} from '../../editor/reusable-fragment';
import {newRecoveryId} from '../../editor/local-recovery';
import {confirmAction,notify} from '../feedback/feedback';
import {Gear,Eye,X,ImageSquare,ArrowLeft} from '@phosphor-icons/react';
import {SyntaxHighlightingExtension} from '@blocknote/core/extensions';
import {codeHighlighter} from '../../editor/highlight';
import {nativeEditorContent} from '../../editor/native';
import {safeLink} from '../../editor/inline';
import {annotationHref} from '../../editor/annotation';
import {inlineEmbedHref} from '../../editor/inline-embed';
import {toCanvasBlocks} from '../../editor/inline-canvas';
import {mathMarkup} from '../../science/model';
import {useEffect,useEffectEvent,useRef,useState,type ClipboardEvent} from 'react';
import {prepareFieldSnapshots,validateFieldSnapshots,normalizeFieldSnapshots,type FieldDefinition} from '../../fields/model';
import {fieldInputValue} from '../../fields/editor';
import {FieldInputs} from '../fields/FieldInputs';
import {normalizeCategoryIds,type CategoryDefinition} from '../../categories/model';
import {categorySelection} from '../../categories/editor';
import {ArticleCategories,CategoryInputs} from '../categories/ArticleCategories';
import {FieldValues} from '../fields/FieldValues';
import {normalizeQa} from '../../qa/metadata';
import {useCreateBlockNote,SuggestionMenuController,getDefaultReactSlashMenuItems} from '@blocknote/react';
import {BlockNoteView} from '@blocknote/mantine';
import {en,zh} from '@blocknote/core/locales';
import '@blocknote/mantine/style.css';
import type {EditorData,SaveDraftInput} from '../../editor/contract';
import {editorInitialContent} from '../../editor/legacy';
import {encodeEditorBody,privateAssetId,type EditorBlock} from '../../editor/document';
import {DraftSaver,DraftSaveRejected} from '../../editor/autosave';
import {saveError,validationError} from '../../editor/errors';
import {editorSchema,createEditorSchema,editorSnapshot,EditorContext} from './schema';
import {normalizePresentation} from '../../domain/presentation';
import {readerIconLabels,type ReaderIconKey} from '../../reader/icon-keys';
import {uploadExtensions,type ManagedAsset,type MediaBlock} from '../../media/model';
import {externalEmbedSource,externalLinkSource} from '../../media/external-embed';
import {kinds,publicationLabel} from '../../workspace/model';
import type {Audience,ContentKind} from '../../domain/model';
import {parseReaderBody} from '../../reader/body';
import {DocumentView} from '../gitbook/Reading/DocumentView';
import {SubmitReview} from '../review/SubmitReview';
import {DocumentTrashAction} from '../lifecycle/DocumentTrashAction';
import {EditorRecovery,InputBackup} from './EditorRecovery';
import {recoveryText} from '../../editor/recovery';
import type {NewTranslation} from './EditorLoader';
type Content=Omit<SaveDraftInput,'expectedSequence'>;
export default function ArticleEditor({initial:provided,recoveryOwner='',newReference=false,newQa=false,newOps=false,newTranslation,fieldDefinitions=[],categoryOptions=[]}:{initial:EditorData|null;recoveryOwner?:string;newReference?:boolean;newQa?:boolean;newOps?:boolean;newTranslation?:NewTranslation;fieldDefinitions?:FieldDefinition[];categoryOptions?:CategoryDefinition[]}){
 const [active,setActive]=useState({initial:provided,generation:0});const [backups,setBackups]=useState<string[]>([]);const initial=active.initial;
 let nodes:EditorBlock[];try{nodes=nativeEditorContent(editorInitialContent(initial?.body??'',initial?.blocks??[]),initial?.assets??[]);}catch{return <section role="alert"><h2>暂时无法载入编辑内容</h2><p>原文仍保留。请返回列表检查资料，避免覆盖内容。</p><textarea readOnly aria-label="保留的正文" value={initial?.body??''}/></section>;}
 return <>{backups.map((backup,index)=><InputBackup key={index} value={backup} locale={initial?.locale??(newTranslation?'en':'zh-CN')} label={initial?.locale==='en'||newTranslation?`Input backup before loading ${index+1}`:`载入前的输入备份 ${index+1}`}/>)}<ReadyEditor recoveryOwner={recoveryOwner} categoryOptions={initial?.categoryOptions??categoryOptions} key={active.generation} initial={initial} newReference={newReference} newQa={newQa} newOps={newOps} newTranslation={newTranslation} fieldDefinitions={initial?.fieldDefinitions??fieldDefinitions} nodes={nodes} hasBackups={backups.length>0} onLoad={(next,copy)=>{window.history.replaceState(null,'',`/admin/editor?article=${encodeURIComponent(next.documentId)}`);setBackups(old=>[...old,copy]);setActive(old=>({initial:next,generation:old.generation+1}));}}/></>;
}
function ReadyEditor({recoveryOwner,initial,newReference,newQa,newOps,newTranslation,fieldDefinitions,categoryOptions,nodes,hasBackups,onLoad}:{initial:EditorData|null;recoveryOwner:string;newReference:boolean;newQa:boolean;newOps:boolean;newTranslation?:NewTranslation;fieldDefinitions:FieldDefinition[];categoryOptions:CategoryDefinition[];nodes:EditorBlock[];hasBackups:boolean;onLoad:(data:EditorData,copy:string)=>void}){
 const [documentId]=useState(()=>initial?.documentId??(()=>{try{return newTranslation?crypto.randomUUID():newRecoveryId(localStorage,recoveryOwner,newQa?'qa':newOps?'ops':newReference?'reference':'article');}catch{return crypto.randomUUID();}})());
 const locale=initial?.locale??(newTranslation?'en':'zh-CN');const translationOf=initial?.translationOf??newTranslation?.sourceId??null;
 const t=(zh:string,en:string)=>locale==='en'?en:zh;
 const [data,setData]=useState(initial);const [title,setTitle]=useState(initial?.title??'');const [description,setDescription]=useState(initial?.description??'');const [releaseNote,setReleaseNote]=useState(initial?.releaseNote??'');const [kind,setKind]=useState<ContentKind>(initial?.kind??newTranslation?.kind??(newQa?'qa':newOps?'ops':newReference?'reference':'article'));const [audience,setAudience]=useState<Audience>(initial?.audience??newTranslation?.audience??(newOps?'ops':'staff'));
 const [categoryIds,setCategoryIds]=useState(()=>normalizeCategoryIds(initial?.categoryIds??newTranslation?.categoryIds));
 const [definitions]=useState(fieldDefinitions);const [prepared]=useState(()=>prepareFieldSnapshots(definitions,initial?.customFields??[]));
 const [fieldInputs,setFieldInputs]=useState<Record<string,string>>(()=>Object.fromEntries(prepared.map(f=>[f.id,f.value===null?'':String(f.value)])));
 const customFields=()=>prepared.map(f=>definitions.some(d=>d.id===f.id&&d.enabled)?{...f,value:fieldInputValue(f.type,fieldInputs[f.id]??'')}:f);
 const fieldPayload=()=>{const values=customFields();validateFieldSnapshots(definitions,values,initial?.customFields??[]);return values.length?{customFields:values}:{};};
 const [qaCategory,setQaCategory]=useState(initial?.qa?.category??'');const [qaPosition,setQaPosition]=useState(String(initial?.qa?.position??0));
 const [tags,setTags]=useState(initial?.tags.join(', ')??'');const [cover,setCover]=useState(initial?.cover??null);const [iconKey,setIconKey]=useState<ReaderIconKey|null>(initial?.iconKey??null);const [assets,setAssets]=useState(initial?.assets??[]);const [selected,setSelected]=useState('');
 const [recoveryHold,setRecoveryHold]=useState(false);
 const [notice,setNotice]=useState<{message:string;tone:'success'|'error';toast:boolean}|null>(null);
 const recoveryRead=useRef<HTMLButtonElement>(null);
 function showNotice(message:string,tone:'success'|'error',toast=true){setNotice({message,tone,toast});if(toast)notify(message,tone);}
 const [validation,setValidation]=useState(()=>{if(initial&&(initial.status==='in_review'||initial.lifecycle!=='active'))return '';try{fieldPayload();return '';}catch{return t('请检查自定义资料的必填项、类型或选项。原有值已保留。','Check the required custom fields, types and choices. Your previous values are still here.');}});const [uploading,setUploading]=useState(false);const [,redraw]=useState(0);const [preview,setPreview]=useState(false);const [theme,setTheme]=useState<'light'|'dark'>('light');
 const titleElement=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{const el=titleElement.current;if(!el)return;const resize=()=>{el.style.height='auto';el.style.height=el.scrollHeight+'px';};resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();},[title]);
 const settingsDialog=useRef<HTMLDialogElement>(null);const settingsTrigger=useRef<HTMLButtonElement>(null);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [settingsSection,setSettingsSection]=useState('');
 const panelNames:Record<string,string>={basic:t('阅读范围与资料','Access and details'),release:t('更新说明','What changed'),categories:t('选择文章分类','Categories'),files:t('封面与附件','Cover and attachments'),fields:t('自定义字段','Custom fields'),actions:t('保存与管理','Save and manage')};
 function openSettings(section=''){setSettingsSection(section);settingsDialog.current?.showModal();setSettingsOpen(true);}
 const uploadCount=useRef(0);
 const [deleting,setDeleting]=useState(false);const [reviewLocked,setReviewLocked]=useState(false);
 const frozen=reviewLocked||deleting||data?.status==='in_review'||(data!==null&&data.lifecycle!=='active');
 const uploadRef=useRef<(file:File)=>Promise<string>>(async()=>{throw new Error('UPLOAD_NOT_READY');});
 const [nativeSchema]=useState(()=>createEditorSchema(nodes));
 const editor=useCreateBlockNote({schema:nativeSchema,dictionary:locale==='en'?en:zh,domAttributes:{editor:{"aria-label":locale==='en'?'Article body':'文章正文'}},
  extensions:[SyntaxHighlightingExtension({createHighlighter:codeHighlighter})],
  links:{isValidLink:safeLink},initialContent:toCanvasBlocks(nodes) as typeof editorSchema.PartialBlock[],
  tables:{splitCells:true,cellBackgroundColor:true,cellTextColor:true,headers:true},
  uploadFile:async(file)=>uploadRef.current(file),
  resolveFileUrl:async(url)=>{const id=privateAssetId(url);if(!id)return '';return `/api/admin/assets/${id}`;},
 },[]);
 const [fragmentsOpen,setFragmentsOpen]=useState(false);
 const [fragmentSelection,setFragmentSelection]=useState<EditorBlock[]>([]);
 const [fragmentUsages,setFragmentUsages]=useState<{familyId:string;version:number;title:string}[]>([]);
 const fragmentAnchor=useRef<string|null>(null);
 function openFragments(){
  if(frozen)return;
  const cursor=editor.getTextCursorPosition().block;
  fragmentAnchor.current=cursor.id;
  const selectedBlocks=editor.getSelection()?.blocks??[cursor];
  setFragmentSelection(editorSnapshot(selectedBlocks as typeof editorSchema.BlockNoteEditor.document) as EditorBlock[]);
  setFragmentUsages(reusableReferences(editorSnapshot(editor.document) as EditorBlock[]));
  setFragmentsOpen(true);
 }
 async function copyFragmentAssets(fragment:ReusableFragment):Promise<Record<string,string>>{
  const sourceIds=reusableAssetIds(fragment.blocks);if(!sourceIds.length)return {};
  if(!data||sourceIds.length>8)throw new Error('FRAGMENT_ASSET_LIMIT');
  const copied:Record<string,string>={};let total=0;
  for(const sourceId of sourceIds){
   const response=await fetch(`/api/admin/assets/${sourceId}`,{cache:'no-store',signal:AbortSignal.timeout(100000)});
   if(!response.ok)throw new Error('FRAGMENT_SOURCE_UNAVAILABLE');
   const mime=response.headers.get('content-type')?.split(';')[0]??'';
   const extension=Object.entries(uploadExtensions).find(([,rule])=>rule.mime===mime)?.[0];
   const length=Number(response.headers.get('content-length'));if(!extension||!Number.isSafeInteger(length)||length<1||total+length>60*1024*1024)throw new Error('FRAGMENT_ASSET_LIMIT');
   total+=length;const blob=await response.blob();if(blob.size!==length)throw new Error('FRAGMENT_SOURCE_UNAVAILABLE');
   let original='';try{const encoded=response.headers.get('content-disposition')?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];if(encoded)original=decodeURIComponent(encoded);}catch{}
   const originalExtension=original.split('.').pop()?.toLowerCase()??'';
   const filename=original&&uploadExtensions[originalExtension]?.mime===mime?original:`reusable-${sourceId}.${extension}`;
   const targetUrl=await uploadRef.current(new File([blob],filename,{type:mime}));
   const targetId=privateAssetId(targetUrl);if(!targetId)throw new Error('FRAGMENT_COPY_FAILED');copied[sourceId]=targetId;
  }
  return copied;
 }
 async function insertFragment(fragment:ReusableFragment){
  if(frozen)return;
  const assetIds=await copyFragmentAssets(fragment);
  const anchor=fragmentAnchor.current&&editor.getBlock(fragmentAnchor.current)?fragmentAnchor.current:editor.getTextCursorPosition().block.id;
  editor.insertBlocks(toCanvasBlocks([createReusableWrapper(fragment,()=>crypto.randomUUID(),assetIds)]) as typeof editorSchema.PartialBlock[],anchor,'after');
  editor.focus();
 }
 async function refreshFragment(fragment:ReusableFragment){
  if(frozen)return false;
  if(!await confirmAction(locale==='en'?`Use snippet version ${fragment.version} in this article? This replaces manual changes inside the snippet. You will still need to save, review and publish this draft.`:`本篇使用的共用片段将换成第 ${fragment.version} 版；插入块内的手动修改会被替换。当前改动仍要保存并二审发布，确定继续？`,t('在本篇采用片段新版？','Use latest snippet version?')))return false;
  const assetIds=await copyFragmentAssets(fragment);
  const references=reusableReferences(editorSnapshot(editor.document) as EditorBlock[]).filter(item=>item.familyId===fragment.familyId&&item.version<fragment.version);
  for(const reference of references){const current=editor.getBlock(reference.blockId);if(!current)continue;const source=(editorSnapshot([current] as typeof editorSchema.BlockNoteEditor.document) as EditorBlock[])[0];const updated=refreshReusableWrapper(source,fragment,()=>crypto.randomUUID(),assetIds);editor.replaceBlocks([current],toCanvasBlocks([updated]) as typeof editorSchema.PartialBlock[]);}
  editor.focus();return true;
 }
 const [annotationOpen,setAnnotationOpen]=useState(false);
 const [annotationNote,setAnnotationNote]=useState('');
 const [annotationError,setAnnotationError]=useState('');
 const annotationSelection=useRef<{from:number;to:number}|null>(null);
 const [inlineOpen,setInlineOpen]=useState(false);
 const [inlineType,setInlineType]=useState<'icon'|'math'|'image'>('icon');
 const [inlineIcon,setInlineIcon]=useState<ReaderIconKey>('lightbulb');
 const [inlineFormula,setInlineFormula]=useState('');
 const [inlineImage,setInlineImage]=useState('');
 const [inlineAlt,setInlineAlt]=useState('');
 const [inlineError,setInlineError]=useState('');
 const inlineSelection=useRef<{from:number;to:number}|null>(null);
 function openAnnotation(){
  const selection=editor._tiptapEditor.state.selection;
  if(selection.empty||!editor.getSelectedText().trim()){setAnnotationError(t('先选中正文里需要解释的文字。','Select the text you want to explain first.'));return;}
  if(!selection.$from.sameParent(selection.$to)||editor.getSelectedText().length>200){setAnnotationError(t('一次只可注释同一段里不超过 200 字的文字。','A note can cover up to 200 characters in one paragraph.'));return;}
  annotationSelection.current={from:selection.from,to:selection.to};setAnnotationNote('');setAnnotationError('');setAnnotationOpen(true);
 }
 function insertAnnotation(){
  const selection=annotationSelection.current;
  if(!selection||frozen)return;
  try{
   const href=annotationHref(annotationNote);
   editor._tiptapEditor.chain().focus().setTextSelection(selection).run();
   editor.createLink(href);
   setAnnotationOpen(false);annotationSelection.current=null;setAnnotationError('');
  }catch{setAnnotationError(t('请填写注释，最多 500 个字。','Add a note of up to 500 characters.'));}
 }
 function openInline(){const selection=editor._tiptapEditor.state.selection;inlineSelection.current={from:selection.from,to:selection.to};setInlineError('');setInlineOpen(true);}
 function insertInline(){
  const selection=inlineSelection.current;if(!selection||frozen)return;
  try{
   let value:string,label:string;
   if(inlineType==='icon'){inlineEmbedHref({type:'icon',icon:inlineIcon});value=inlineIcon;label='◆';}
   else if(inlineType==='math'){mathMarkup(inlineFormula,false);inlineEmbedHref({type:'math',source:inlineFormula});value=inlineFormula;label='∑';}
   else {const asset=assets.find(item=>item.id===inlineImage&&item.status==='ready'&&item.mime.startsWith('image/'));if(!asset)throw new Error('IMAGE_REQUIRED');inlineEmbedHref({type:'image',assetId:asset.id});value=asset.id;label=inlineAlt.trim()||asset.filename;}
   editor._tiptapEditor.chain().focus().setTextSelection(selection).run();editor.insertInlineContent([{type:'juyuInline',props:{kind:inlineType,value,label}}]);
   setInlineOpen(false);inlineSelection.current=null;setInlineError('');
  }catch(error){setInlineError(error instanceof Error&&error.message==='IMAGE_REQUIRED'?t('先选择本篇已上传的图片。','Choose an image uploaded to this article first.'):t('请检查图标、公式或图片资料后重试。','Check the icon, equation or image and try again.'));}
 }
 const initialContent:Content={locale,translationOf,categoryIds:normalizeCategoryIds(initial?.categoryIds??newTranslation?.categoryIds),...(prepared.length?{customFields:prepared}:{}),title:initial?.title??'',description:initial?.description??'',releaseNote:initial?.releaseNote??'',body:encodeEditorBody(nodes),kind:initial?.kind??newTranslation?.kind??(newQa?'qa':newOps?'ops':newReference?'reference':'article'),audience:initial?.audience??newTranslation?.audience??(newOps?'ops':'staff'),tags:initial?.tags??[],cover:initial?.cover??null,iconKey:initial?.iconKey??null,...((initial?.kind??newTranslation?.kind??(newQa?'qa':newOps?'ops':newReference?'reference':'article'))==='qa'?{qa:normalizeQa(initial?.qa)}:{})};
 const [saver]=useState(()=>new DraftSaver<Content,EditorData>(initialContent,initial?.sequence??null,async(value,sequence)=>{
  let response:Response;
  try{response=await fetch(`/api/admin/editor/${encodeURIComponent(documentId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,expectedSequence:sequence}),signal:AbortSignal.timeout(20000)});}catch{throw new Error('NETWORK_ERROR');}
  const result=await response.json().catch(()=>null);
  if(!response.ok){const code=typeof result?.error==='string'?result.error:'UNRECOGNIZED_RESPONSE';throw response.status>=400&&response.status<500?new DraftSaveRejected(code):new Error(code);}
  if(!result)throw new Error('INVALID_ACK');
  if(result.documentId!==documentId||result.locale!==locale||(result.translationOf??null)!==translationOf||result.body!==value.body||result.title!==value.title||(result.description??'')!==(value.description??'')||(result.releaseNote??'')!==(value.releaseNote??'')||JSON.stringify(result.tags)!==JSON.stringify(value.tags)||(result.iconKey??null)!==(value.iconKey??null))throw new Error('INVALID_ACK');
  if(JSON.stringify(normalizeCategoryIds(result.categoryIds))!==JSON.stringify(normalizeCategoryIds(value.categoryIds)))throw new Error('INVALID_ACK');
  if(value.kind==='qa'&&JSON.stringify(normalizeQa(result.qa))!==JSON.stringify(normalizeQa(value.qa)))throw new Error('INVALID_ACK');
  if(JSON.stringify(normalizeFieldSnapshots(result.customFields))!==JSON.stringify(normalizeFieldSnapshots(value.customFields)))throw new Error('INVALID_ACK');
  return result;
 },()=>redraw(n=>n+1),result=>{setData(result);showNotice(t('草稿已保存。正式版本仍需审核发布后才会更新。','Draft saved. Readers will see this version after review and publication.'),'success',false);window.history.replaceState(null,'',`/admin/editor?article=${encodeURIComponent(documentId)}`);}));
 const touch=useEffectEvent(()=>{
  if(frozen)return;
  try{
   if(kind==='qa'&&!/^\d{1,6}$/.test(qaPosition))throw new Error('INVALID_QA');
   let presentation:ReturnType<typeof normalizePresentation>;
   try{presentation=normalizePresentation({tags:tags.split(/[,，]/).map(s=>s.trim()).filter(Boolean),cover,iconKey});}catch{throw new Error('INVALID_PRESENTATION');}
   let categories:ReturnType<typeof categorySelection>;
   try{categories=categorySelection(categoryOptions,categoryIds,initial?.categoryIds);}catch{throw new Error('INVALID_CATEGORY');}
   let fields:ReturnType<typeof fieldPayload>;
   try{fields=fieldPayload();}catch{throw new Error('INVALID_FIELDS');}
   let body:string;
   try{body=encodeEditorBody(editorSnapshot(editor.document));}catch(error){throw error instanceof Error&&error.message==='PRIVATE_EDITOR_FILE_REQUIRED'?error:new Error('INVALID_BODY');}
   let qa:ReturnType<typeof normalizeQa>|undefined;
   if(kind==='qa')try{qa=normalizeQa({category:qaCategory,position:Number(qaPosition)});}catch{throw new Error('INVALID_QA');}
   const content:Content={locale,translationOf,categoryIds:categories,...fields,title:title.trim(),description:description.trim(),releaseNote:releaseNote.trim(),body,kind,audience,tags:presentation.tags,cover:presentation.cover,iconKey:presentation.iconKey,...(qa===undefined?{}:{qa})};
   saver.update(content);setValidation(!content.title?t('请填写文章标题，才能保存。','Add a title before saving.'):'');setNotice(null);
  }catch(error){setValidation(validationError(error instanceof Error?error.message:'INVALID_INPUT',locale));}
 });
 useEffect(()=>editor.onChange(()=>touch()),[editor]);
 const first=useRef(true);useEffect(()=>{if(first.current){first.current=false;return;}touch();},[title,description,releaseNote,kind,audience,tags,cover,iconKey,qaCategory,qaPosition,fieldInputs,categoryIds]);
 const leaving=useRef(false);const state=saver.state;const conflict=['CONFLICT','FIELD_CONFLICT','INVALID_STATE','INACTIVE_DOCUMENT'].includes(state.error);const sequence=data?.sequence??state.sequence;const dirty=state.dirty||Boolean(validation);const mustWarn=dirty||hasBackups||reviewLocked;
 useEffect(()=>{if(state.error)notify(saveError(state.error,locale),'error');},[state.error,locale]);
 useEffect(()=>{if(!mustWarn&&!state.busy)return;const warn=(e:BeforeUnloadEvent)=>{if(leaving.current)return;e.preventDefault();e.returnValue='';};const link=async(e:MouseEvent)=>{const a=(e.target as Element).closest?.('a[href]') as HTMLAnchorElement|null;if(!a||e.defaultPrevented||a.closest('.bn-editor[contenteditable="true"]')||a.target==='_blank'||e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();e.stopPropagation();if(await confirmAction(locale==='en'?'You have unsaved input or a recovery backup on this page. Leave anyway?':'页面有未保存输入或恢复备份，确定离开吗？',locale==='en'?'Leave the editor?':'离开编辑页？')){leaving.current=true;window.location.assign(a.href);}};window.addEventListener('beforeunload',warn);document.addEventListener('click',link,true);return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',link,true);};},[mustWarn,state.busy,locale]);
 useEffect(()=>{if(recoveryHold||!state.dirty||state.busy||state.blocked||validation||frozen)return;const timer=setTimeout(()=>void saver.save(),1200);return()=>clearTimeout(timer);},[recoveryHold,saver,state.dirty,state.busy,state.blocked,validation,frozen,title,description,releaseNote,tags,kind,audience,cover,qaCategory,qaPosition,fieldInputs,categoryIds,editor.document]);
 useEffect(()=>{const update=()=>setTheme(document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');update();const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});const system=matchMedia('(prefers-color-scheme: dark)');system.addEventListener('change',update);return()=>{observer.disconnect();system.removeEventListener('change',update);};},[]);
 function add(type:MediaBlock['type'],advanced=false){
  const cursor=editor.getTextCursorPosition().block;
  if(type==='table'){const headers=[t('项目','Item'),t('说明','Details')];if(advanced){const id=crypto.randomUUID();editor.insertBlocks([{id,type:'juyu',props:{payload:JSON.stringify({id,type:'table',headers,rows:[['','']],view:'grid',searchable:true})}}],cursor,'after');}else editor.insertBlocks([{type:'table',content:{type:'tableContent',rows:[{cells:headers.map(value=>[value])},{cells:[[''],['']]}]}}],cursor,'after');return;}
  if(type==='code'){
   if(advanced){const id=crypto.randomUUID();editor.insertBlocks([{id,type:'juyu',props:{payload:JSON.stringify({id,type:'code',language:'text',code:'',lineNumbers:true,wrap:false,expandable:false,collapsedLines:10})}}],cursor,'after');return;}
   const [block]=editor.insertBlocks([{type:'codeBlock'}],cursor,'after');editor.setTextCursorPosition(block,'start');editor.focus();return;
  }
  if(type==='image'||type==='video'||type==='audio'||type==='file'){const asset=assets.find(a=>a.id===selected&&a.status==='ready');if(asset){if(type==='image'&&advanced){const id=crypto.randomUUID();editor.insertBlocks([{id,type:'juyu',props:{payload:JSON.stringify({id,type:'image',assetId:asset.id,caption:'',alt:asset.filename,darkAssetId:null})}}],cursor,'after');}else editor.insertBlocks([{type,props:{url:'/api/assets/'+asset.id,name:asset.filename}}],cursor,'after');}return;}
  const id=crypto.randomUUID();const block:MediaBlock=type==='hint'?{id,type,style:'info',title:'',body:''}:type==='tabs'?{id,type,tabs:[{id:crypto.randomUUID(),title:t('标签 1','Tab 1'),body:''}]}:type==='steps'?{id,type,steps:[{id:crypto.randomUUID(),title:t('第一步','Step 1'),body:''}]}:type==='columns'?{id,type,columns:[{id:crypto.randomUUID(),title:t('左栏','Left column'),body:''},{id:crypto.randomUUID(),title:t('右栏','Right column'),body:''}]}:type==='articleReference'?{id,type,targetId:''}:type==='button'?{id,type,label:t('打开资料','Open article'),href:'',variant:'primary'}:type==='externalEmbed'?{id,type,url:'',caption:''}:{id,type,source:type==='math'?'x^2':t('flowchart TD\n A[提交] --> B[审核]','flowchart TD\n A[Submit] --> B[Review]'),caption:''};
  editor.insertBlocks([{id,type:'juyu',props:{payload:JSON.stringify(block)}}],cursor,'after');
 }
 async function upload(file:File):Promise<string>{
  if(frozen||!data){showNotice(t('请先填写标题并保存草稿，再上传文件。','Add a title and save the draft before uploading files.'),'error');throw new Error('SAVE_DRAFT_FIRST');}
  const rule=uploadExtensions[file.name.split('.').pop()?.toLowerCase()??''];
  if(!rule||!file.size||file.size>rule.max*1024*1024){showNotice(t('文件格式或大小不符合要求。图片5MB、影片50MB、音频/PDF20MB、TXT/CSV5MB。','This file type or size is not supported. Images: 5 MB; video: 50 MB; audio and PDF: 20 MB; TXT and CSV: 5 MB.'),'error');throw new Error('INVALID_UPLOAD');}
  uploadCount.current++;setUploading(true);
  try{const r=await fetch(`/api/admin/media/${encodeURIComponent(documentId)}/upload`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file,signal:AbortSignal.timeout(100000)});const a=await r.json();if(!r.ok||a.status!=='ready'||!privateAssetId('/api/assets/'+a.id))throw new Error('UPLOAD_FAILED');setAssets(old=>[a as ManagedAsset,...old]);setSelected(a.id);showNotice(t('文件已上传。','File uploaded.'),'success');return `/api/assets/${a.id}`;}
  catch{showNotice(t('上传未确认成功，请重试或重新载入核对文件列表。','Could not confirm the upload. Try again, or reload and check the file list.'),'error');throw new Error('UPLOAD_FAILED');}finally{uploadCount.current--;setUploading(uploadCount.current>0);}
 }
 function pasteExternalEmbed(event:ClipboardEvent<HTMLDivElement>){
  if(frozen||event.clipboardData.files.length||!((event.target as HTMLElement).closest('.bn-editor'))||(event.target as HTMLElement).closest('input,textarea'))return;
  const raw=event.clipboardData.getData('text/plain'),value=raw.trim(),link=externalLinkSource(value),source=externalEmbedSource(value);
  if(!link||raw!==value)return;
  const current=editor.getTextCursorPosition().block;
  if(current.type!=='paragraph'||!Array.isArray(current.content)||current.content.length||current.children.length)return;
  event.preventDefault();event.stopPropagation();
  const id=crypto.randomUUID();
  editor.insertBlocks([{id,type:'juyu',props:{payload:JSON.stringify({id,type:'externalEmbed',url:link.original,caption:''})}}],current,'after');
  editor.removeBlocks([current]);
  showNotice(source?t(`${source.provider} 链接已转成外部内容。员工点击后才会加载。`,`${source.provider} link added. Readers choose when to load it.`):t('网址已转成外部链接卡片。员工点击后才会打开网站。','Link card added. Readers choose when to open the website.'),'success');
 }
 useEffect(()=>{uploadRef.current=upload;});
 let body='';try{body=encodeEditorBody(editorSnapshot(editor.document));}catch{}
 const previewDocument=body?parseReaderBody(body):null;
 const outlineSections=previewDocument?.sections??[];
 const outlineDepth=Math.min(...outlineSections.map(section=>section.depth),6);
 const copy=recoveryText({documentId,sequence,locale,translationOf,categoryIds,categoryOptions,fieldInputs,fieldDefinitions:definitions,savedCustomFields:initial?.customFields??[],title,description,releaseNote,kind,audience,tags,cover,...(kind==='qa'?{qa:{category:qaCategory,position:qaPosition}}:{}),body:editor.document});
 return <section className={`article-editor editor-focused${preview?' is-previewing':''}`} aria-label={t('文章编辑器','Article editor')}>
 <div className="editor-toolbar"><a className="editor-back" href={kind==='qa'?'/admin?kind=qa&view=list':'/admin'}><ArrowLeft size={17}/>{kind==='qa'?t('Q&A 管理','Manage Q&A'):t('内容管理','Content')}</a><span className="editor-page-label">{locale==='en'?'English version':kind==='qa'?(data?'编辑问答':'新建问答'):providedLabel(data)}</span>{data&&<a className="editor-language-link" href={locale==='en'?`/admin/editor?article=${encodeURIComponent(translationOf!)}`:data.translation?`/admin/editor?article=${encodeURIComponent(data.translation.documentId)}`:`/admin/editor?translate=${encodeURIComponent(documentId)}`}>{t(data.translation?'编辑英文版':'撰写英文版','View Chinese source')}</a>}<p role="status" className={state.error?'save-state has-error':'save-state'}>{state.busy?t('正在保存…','Saving…'):state.error?saveError(state.error,locale):dirty?t('有未保存修改','Unsaved changes'):data?t('所有修改已保存','All changes saved'):t('草稿 · 自动保存','Draft · Autosave on')}</p>
 <div className="editor-toolbar-actions">{(state.error||recoveryHold)&&<button type="button" disabled={frozen||state.busy||!state.dirty||Boolean(validation)} onClick={()=>{if(conflict){recoveryRead.current?.click();return;}setRecoveryHold(false);void saver.save(true);}}>{conflict?t('查看最新版本并对照','Compare with latest version'):state.error?t('重试保存','Try saving again'):t('立即保存','Save now')}</button>}<button type="button" className="editor-preview-toggle" aria-pressed={preview} onClick={()=>setPreview(v=>!v)}><Eye size={17}/>{preview?t('关闭草稿预览','Close preview'):t('预览草稿','Preview draft')}</button><button type="button" disabled={frozen} onMouseDown={event=>event.preventDefault()} onClick={openAnnotation}>{t('添加行内注释','Add inline note')}</button><button type="button" disabled={frozen} onMouseDown={event=>event.preventDefault()} onClick={openInline}>{t('插入行内元素','Insert inline item')}</button><button type="button" disabled={frozen} onMouseDown={event=>event.preventDefault()} onClick={openFragments}>{t('共用片段','Reusable snippets')}</button><button type="button" ref={settingsTrigger} aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={()=>openSettings()}><Gear size={17}/>{kind==='qa'?t('问答设置','Q&A settings'):t('文章设置','Article settings')}</button>{(!data||data.lifecycle==='active')&&<SubmitReview compact locale={locale} id={documentId} sequence={sequence} disabled={dirty||state.busy||uploading||frozen||!data||Boolean(data&&data.status!=='draft')} onLock={setReviewLocked} onSubmitted={result=>{setData(current=>current?{...current,sequence:result.sequence,status:'in_review'}:current);}}/>}</div></div>
 <div className="editor-notices">
 {locale==='zh-CN'&&data&&<p className="editor-translation-note">英文版：{!data.translation?'未开始':data.translation.publishedRevision!==null?'已发布':data.translation.status==='in_review'?'待审核':data.translation.status==='changes_requested'?'待修改':'草稿'}。英文内容需要单独撰写、审核和发布。</p>}
 {locale==='en'&&<p className="editor-translation-note">Write this version for an English-speaking teammate. It has its own draft, review and publication. Nothing is translated automatically.{newTranslation&&<> Chinese source: {newTranslation.sourceTitle}.</>}</p>}
 {recoveryHold&&<p role="status">{t('已恢复输入，自动保存已暂停。请核对后点击立即保存。','Recovered input is here. Autosave is paused. Check it, then select Save now.')}</p>}
 <LocalRecovery owner={recoveryOwner} id={documentId} sequence={sequence} text={copy} dirty={dirty} blocked={frozen||state.busy||state.blocked} locale={locale} onRestore={raw=>{
 const v=JSON.parse(raw);if(v.documentId!==documentId||(v.locale??'zh-CN')!==locale||(v.translationOf??null)!==translationOf||typeof v.title!=='string'||typeof v.tags!=='string'||!Object.hasOwn(kinds,v.kind)||!['staff','ops','admin'].includes(v.audience)||!Array.isArray(v.body))throw Error('INVALID_RECOVERY');
 const restored=editorSnapshot(v.body);if(data&&v.kind!==data.kind)throw Error('INVALID_RECOVERY');
 setRecoveryHold(true);setTitle(v.title);setDescription(typeof v.description==='string'?v.description:'');setReleaseNote(typeof v.releaseNote==='string'?v.releaseNote:'');setKind(v.kind);setAudience(v.audience);setTags(v.tags);setCover(v.cover);setCategoryIds(normalizeCategoryIds(v.categoryIds));setFieldInputs(v.fieldInputs??{});setQaCategory(v.qa?.category??'');setQaPosition(String(v.qa?.position??0));editor.replaceBlocks(editor.document,toCanvasBlocks(restored as EditorBlock[]) as typeof editorSchema.PartialBlock[]);
 }}/>

 {state.error&&<EditorRecovery readButtonRef={recoveryRead} documentId={documentId} sequence={sequence} busy={state.busy||uploading||frozen} copy={copy} locale={locale} onLoad={next=>{if(!frozen)onLoad(next,copy);}}/>}
 {validation&&validation!==t('请填写文章标题，才能保存。','Add a title before saving.')&&<p role="alert">{validation}</p>}{frozen&&<p role="alert">{reviewLocked?t('正在核对二审提交结果，编辑暂时暂停。请在二审窗口完成核对。','Checking the review submission. Finish checking it in the review dialog.'):data?.status==='in_review'?t('已提交二审，本次版本暂时锁定。已有正式版本继续可读。','This draft is in review and locked. The published version is still available.'):t('当前内容已停用，不能编辑。请先完成相应流程。','This article is inactive and cannot be edited.')}</p>}{notice?.toast&&<p role={notice.tone==='error'?'alert':'status'}>{notice.message}</p>}{data&&(data.publishedRevision!==null||data.status!=='draft')&&<p className="editor-published-note">{locale==='en'?`Status: ${data.status.replaceAll('_',' ')}${data.publicationNumber?` · Published version ${data.publicationNumber}`:''}`:publicationLabel({publicationNumber:data.publicationNumber,revision:0,publishedRevision:data.publishedRevision,status:data.status as 'draft'})}</p>}
 {data&&data.publishedRevision!==null&&<p className="editor-publication-guidance">{t('修改会保存为新草稿，旧正式版继续可读；新稿需要重新二审和发布。','Changes are saved as a new draft. The published version stays available until this draft is reviewed and published.')}</p>}

 </div><div className="editor-workarea"><div className="editor-writing"><div className="editor-document-heading">{kind!=='qa'&&<button className="editor-cover-trigger" type="button" onClick={()=>openSettings('files')}><ImageSquare size={17}/>{cover?t('管理封面','Manage cover'):t('添加封面','Add cover')}</button>}<span className="editor-draft-label">{locale==='en'?{draft:'Draft',in_review:'In review',changes_requested:'Changes requested',approved:'Approved',queued:'Scheduled',published:'Published'}[data?.status??'draft']:{draft:'草稿',in_review:'等待二审',changes_requested:'需要修改',approved:'已经批准',queued:'等待发布',published:'已经发布'}[data?.status??'draft']}</span><label className="editor-title-label"><span className="sr-only">{t('文章标题','Article title')}</span><textarea ref={titleElement} aria-label={kind==='qa'?t('问题','Question'):t('文章标题','Article title')} placeholder={kind==='qa'?t('输入员工会问的问题','Enter a question an employee might ask'):t('请输入文章标题','Enter an article title')} rows={1} maxLength={200} disabled={frozen} value={title} onChange={e=>setTitle(e.target.value)}/></label>{kind!=='qa'&&<label className="editor-description-label"><span className="sr-only">{t('文章简介','Short description')}</span><textarea aria-label={t('文章简介','Short description')} placeholder={t('用一句话说明这篇资料能帮助员工解决什么问题（选填）','In one sentence, tell readers what this article helps them do (optional)')} rows={2} maxLength={300} disabled={frozen} value={description} onChange={e=>setDescription(e.target.value)}/><small>{Array.from(description).length}/300 · {t('审核发布后才会显示','Visible after review and publication')}</small></label>}{!title.trim()&&<p className="editor-title-hint">{kind==='qa'?t('先填写问题，再在下方编写标准答案。','Start with the question, then write the answer below.'):t('先给文章起个标题，之后修改会自动保存。','Give this article a title to turn on autosave.')}</p>}<div className="editor-metadata-summary">{kind==='qa'?<label className="qa-editor-category">{t('问答分类','Q&A category')}<input aria-label={t('问答分类','Q&A category')} maxLength={80} disabled={frozen} value={qaCategory} placeholder={t('例如：账户问题','For example: Accounts')} onChange={e=>setQaCategory(e.target.value)}/></label>:<button type="button" onClick={()=>openSettings('categories')}>{categoryIds.length?t('分类：','Categories: ')+categoryIds.map(id=>categoryOptions.find(c=>c.id===id)?.name??t('原有分类','Previous category')).slice(0,2).join(locale==='en'?', ':'、')+(categoryIds.length>2?t(` 等 ${categoryIds.length} 项`,` and ${categoryIds.length} more`):''):t('添加分类','Add categories')}</button>}<button type="button" onClick={()=>openSettings('basic')}>{t('谁可以阅读：','Who can read: ')}{locale==='en'?{staff:'All staff',ops:'Ops and Admin',admin:'Admin only'}[audience]:{staff:'全体员工',ops:'运营和管理员',admin:'仅管理员'}[audience]}</button><button type="button" aria-label={t('更多文章设置','More article settings')} onClick={()=>openSettings()}>{t('更多设置','More settings')}</button></div></div>
 {(kind==='article'||kind==='ops')&&<div className="editor-outline-guidance"><p className="editor-outline-status">{outlineSections.length?t(`本页目录 · ${outlineSections.length} 个标题，可在草稿预览中查看。`,`On this page · ${outlineSections.length} headings. Check their order in the draft preview.`):t('本页目录尚未生成。将正文小标题设为“标题”；只加粗不会进入目录。','No page outline yet. Use heading blocks; bold text alone does not appear in the outline.')}</p><details className="editor-outline-help"><summary>{t('如何设置标题？','How do I add headings?')}</summary><div><p>{t('在正文新的一行输入 ','On a new line, type ')}<code>/</code>{t('，选择“一级标题”“二级标题”或“三级标题”。已有文字可通过段落左侧菜单改成标题。',', then choose Heading 1, 2 or 3. You can also turn an existing paragraph into a heading from its block menu.')}</p><p>{t('标题按层级生成右侧目录；只把文字','Headings build the page outline. Making text ')}<strong>{t('加粗','bold')}</strong>{t('，不会生成目录。页面顶部的文章名称也不是正文小标题。',' does not add it to the outline. The article title is separate from body headings.')}</p><p>{t('左侧的主分类、子分类在“添加分类”中设置，与正文标题分开管理。写好后打开“预览草稿”检查层级；正式页面在二审发布后更新。','Set directory categories separately under Add categories. Use Preview draft to check your headings. Readers see changes only after review and publication.')}</p></div></details></div>}
 {inlineOpen&&<div className="editor-annotation-composer editor-inline-composer" role="dialog" aria-label={t('插入行内元素','Insert inline item')}><label>{t('元素类型','Item type')}<select aria-label={t('行内元素类型','Inline item type')} value={inlineType} onChange={event=>{setInlineType(event.target.value as typeof inlineType);setInlineError('');}}><option value="icon">{t('小图标','Icon')}</option><option value="math">{t('数学公式','Equation')}</option><option value="image">{t('行内图片','Image')}</option></select></label>{inlineType==='icon'&&<label>{t('图标','Icon')}<select aria-label={t('行内图标','Inline icon')} value={inlineIcon} onChange={event=>setInlineIcon(event.target.value as ReaderIconKey)}>{Object.entries(readerIconLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}{inlineType==='math'&&<label>{t('公式内容','Equation')}<input aria-label={t('行内公式','Inline equation')} maxLength={350} value={inlineFormula} onChange={event=>setInlineFormula(event.target.value)} placeholder="e.g. x^2+y^2"/></label>}{inlineType==='image'&&<><label>{t('已上传图片','Uploaded image')}<select aria-label={t('行内图片','Inline image')} value={inlineImage} onChange={event=>setInlineImage(event.target.value)}><option value="">{t('请选择图片','Choose an image')}</option>{assets.filter(asset=>asset.status==='ready'&&asset.mime.startsWith('image/')).map(asset=><option key={asset.id} value={asset.id}>{asset.filename}</option>)}</select></label><label>{t('图片说明','Image description')}<input aria-label={t('行内图片说明','Inline image description')} maxLength={100} value={inlineAlt} onChange={event=>setInlineAlt(event.target.value)} placeholder={t('让员工知道图片内容','Describe the image for readers')}/></label>{!assets.some(asset=>asset.status==='ready'&&asset.mime.startsWith('image/'))&&<p>{t('先在文章设置中上传图片，保存草稿后再插入。','Upload an image in article settings and save the draft before inserting it.')}</p>}</>}{inlineError&&<p role="alert">{inlineError}</p>}<div><button type="button" onClick={()=>{setInlineOpen(false);inlineSelection.current=null;}}>{t('取消','Cancel')}</button><button type="button" onClick={insertInline}>{t('插入正文','Insert')}</button></div></div>}
 <EditorContext.Provider value={{documentId,assets,frozen,locale}}><div className="editor-canvas" onPasteCapture={pasteExternalEmbed}>{kind==='qa'&&<p className="qa-answer-label">{locale==='en'?'Answer':'标准答案'}</p>}{annotationError&&!annotationOpen&&<p role="alert" className="editor-annotation-error">{annotationError}</p>}{annotationOpen&&<div className="editor-annotation-composer" role="dialog" aria-label={t('添加行内注释','Add inline note')}><label>{t('注释内容','Note')}<textarea aria-label={t('注释内容','Note')} rows={3} maxLength={500} value={annotationNote} onChange={event=>{setAnnotationNote(event.target.value);setAnnotationError('');}} placeholder={t('员工点击文字时看到的解释','What readers see when they select this note')}/></label>{annotationError&&<p role="alert">{annotationError}</p>}<div><button type="button" onClick={()=>{setAnnotationOpen(false);annotationSelection.current=null;setAnnotationError('');}}>{t('取消','Cancel')}</button><button type="button" disabled={!annotationNote.trim()||frozen} onClick={insertAnnotation}>{t('插入注释','Insert note')}</button></div></div>}<BlockNoteView editor={editor} editable={!frozen} theme={theme} slashMenu={false}>
  <SuggestionMenuController triggerCharacter="/" getItems={async query=>{
   const extra=([['hint',t('提示框','Callout')],['tabs',t('分页标签','Tabs')],['steps',t('操作步骤','Steps')],['columns',t('分栏布局','Columns')],['articleReference',t('引用文章','Article card')],['button',t('操作按钮','Button')],['externalEmbed',t('外部内容','External content')],['math',t('数学公式','Equation')],['diagram',t('流程图','Diagram')]] as const).map(([type,title])=>({title,group:t('扩展内容','More blocks'),aliases:[type],onItemClick:()=>add(type)}));
   return [...getDefaultReactSlashMenuItems(editor),...extra,{title:t('资料表格','Data table'),group:t('扩展内容','More blocks'),aliases:['table','表格','筛选'],onItemClick:()=>add('table',true)},{title:t('代码示例','Code example'),group:t('扩展内容','More blocks'),aliases:['code','代码','文件名','行号'],onItemClick:()=>add('code',true)}].filter(item=>[item.title,...(item.aliases??[])].some(text=>text.toLowerCase().includes(query.toLowerCase())));
  }}/>
 </BlockNoteView></div></EditorContext.Provider>
 {fragmentsOpen&&<ReusableFragmentDialog selection={fragmentSelection} usages={fragmentUsages} locale={locale} onInsert={insertFragment} onRefresh={refreshFragment} onClose={()=>setFragmentsOpen(false)}/>}
 </div>{preview&&<section className="editor-preview" aria-label={locale==='en'?'Publication preview':'发布效果预览'}><div className="editor-preview-heading"><strong>{locale==='en'?'Publication preview':'发布效果预览'}</strong><button type="button" aria-label={locale==='en'?'Close preview':'关闭预览'} onClick={()=>setPreview(false)}><X size={18}/></button></div><h2>{title||(locale==='en'?'Untitled draft':'未命名草稿')}</h2>{kind!=='qa'&&description.trim()&&<p className="reader-page-description">{description.trim()}</p>}<p>{locale==='en'?'Draft · Not published':'当前草稿 · 尚未发布'}</p>{(frozen||!validation)&&<FieldValues fields={frozen?data?.customFields:customFields()}/>}{previewDocument?<>{(kind==='article'||kind==='ops')&&<nav className="editor-preview-outline" aria-label={locale==='en'?'On this page preview':'本页内容预览'}><strong>{locale==='en'?'On this page':'本页内容'}</strong>{outlineSections.length?<ol>{outlineSections.map(section=><li key={section.id} style={{paddingInlineStart:(section.depth-outlineDepth)*12}}><button type="button" onClick={event=>{const container=event.currentTarget.closest('.editor-preview');const target=Array.from(container?.querySelectorAll<HTMLElement>('.gitbook-document [id]')??[]).find(element=>element.id===section.id);if(!target)return;for(let parent=target.parentElement;parent&&parent!==container;parent=parent.parentElement){if(parent instanceof HTMLDetailsElement)parent.open=true;}target.scrollIntoView({block:'start',behavior:'auto'});target.focus({preventScroll:true});}}>{section.title||(locale==='en'?'Untitled heading':'未命名标题')}</button></li>)}</ol>:<p>{locale==='en'?'Add a heading to show an on-page outline after publication.':'正文尚未设置标题，发布后不会显示本页目录。'}</p>}</nav>}<DocumentView document={previewDocument} documentId={documentId} locale={locale} admin/></>:<p>{locale==='en'?'Fix the current content to preview it. Your draft is still here.':'当前内容有待修正，预览暂不可用。输入仍保留。'}</p>}</section>}
 </div><dialog ref={settingsDialog} className="editor-settings-drawer" aria-labelledby="editor-settings-title" onClose={()=>{setSettingsOpen(false);settingsTrigger.current?.focus();}}><div className="editor-settings-heading"><h2 id="editor-settings-title">{panelNames[settingsSection]??t('文章设置','Article settings')}</h2><button type="button" aria-label={t('关闭文章设置','Close article settings')} onClick={()=>settingsDialog.current?.close()}><X size={20}/></button></div><div className="editor-settings-content">{settingsSection?<button className="editor-settings-back" type="button" onClick={()=>setSettingsSection('')}><ArrowLeft size={16}/>{t('全部设置','All settings')}</button>:<nav className="editor-settings-menu" aria-label={t('文章设置项目','Article setting options')}>{Object.entries(panelNames).map(([key,label])=><button key={key} type="button" onClick={()=>setSettingsSection(key)}><strong>{label}</strong><span>{locale==='en'?{basic:'Set the content type, access and tags',release:'Add a note for the next published version',categories:'Choose where this article appears',files:'Upload files and choose a cover',fields:'Fill in team-specific details',actions:'Save a backup, view history or move to trash'}[key]:{basic:'设置资料类型、阅读权限和标签',release:'撰写二审通过后显示的版本说明',categories:'选择文章在资料库中的位置',files:'上传文件，选择文章封面',fields:'填写团队设置的补充资料',actions:'备份输入、查看历史或移入回收站'}[key]}</span></button>)}</nav>}<section hidden={settingsSection!=='basic'} data-section="basic"> <fieldset disabled={frozen}><legend>{t('文章资料','Article details')}</legend><div className="editor-metadata"><label>{t('资料类型','Content type')}<select value={kind} disabled={data!==null||state.busy||newQa||newOps||Boolean(newTranslation)} onChange={e=>{const v=e.target.value as ContentKind;setKind(v);if(v==='ops'&&audience==='staff')setAudience('ops');}}>{Object.entries(kinds).map(([v,n])=><option key={v} value={v}>{locale==='en'?{article:'Knowledge article',ops:'OPS Internal',reference:'Reference',qa:'Q&A'}[v]??n:n}</option>)}</select></label><label>{t('阅读范围','Who can read this')}<select value={audience} onChange={e=>setAudience(e.target.value as Audience)}>{kind!=='ops'&&<option value="staff">{t('全体员工（客服、运营、管理员）','All staff (Support, Ops and Admin)')}</option>}<option value="ops">{t('运营和管理员','Ops and Admin')}</option><option value="admin">{t('仅管理员','Admin only')}</option></select></label><label>{t('文章标签','Tags')}<input maxLength={500} value={tags} onChange={e=>setTags(e.target.value)} placeholder={t('例如：域名转入，客户验证','For example: Domain transfer, customer verification')}/></label></div></fieldset>
 <fieldset disabled={frozen}><legend>{t('目录外观','Directory appearance')}</legend><label>{t('文章目录图标','Directory icon')}<select aria-label={t('文章目录图标','Directory icon')} value={iconKey??''} onChange={e=>setIconKey(e.target.value?e.target.value as ReaderIconKey:null)}><option value="">{t('默认文件图标','Default file icon')}</option>{Object.entries(readerIconLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><p className="qa-editor-note">{t('图标随草稿保存，二审发布后员工才会看到。','The icon is saved with this draft. Readers see it after review and publication.')}</p></fieldset>
 {kind==='qa'&&<fieldset disabled={frozen}><legend>{t('问题分类与排序','Q&A category and order')}</legend><div className="editor-metadata"><label>{t('问答分类','Q&A category')}<input maxLength={80} value={qaCategory} onChange={e=>setQaCategory(e.target.value)} placeholder={t('例如：账户问题','For example: Accounts')}/></label><label>{t('问答排序','Display order')}<input type="number" min="0" max="999999" step="1" value={qaPosition} onChange={e=>setQaPosition(e.target.value)}/></label></div><p className="qa-editor-note">{t('标题填写问题，正文填写答案。分类留空表示未分类；排序数字越小越靠前，相同数字按问题标题排序。问答分类只用于查找，不改变既有阅读权限。分类和排序修改也须二审发布。','Write the question as the title and its answer in the body. Leave the category blank for Uncategorised. Lower numbers appear first; ties sort by question. The category helps readers find answers but never changes access. Changes need review before publication.')}</p></fieldset>}
 </section><section hidden={settingsSection!=='release'} data-section="release"><fieldset disabled={frozen}><legend>{t('本次发布的更新说明','What changed in this version')}</legend><label>{t('员工在更新日志中看到的说明','Note shown in the update log')}<textarea aria-label={t('更新说明','Update note')} rows={5} maxLength={600} value={releaseNote} onChange={event=>setReleaseNote(event.target.value)} placeholder={t('例如：补充了账户邮箱变更的审核步骤与所需资料。','For example: Added the review steps and documents needed to update an account email.')}/></label><p className="qa-editor-note">{t('选填，最多 600 字。它随当前草稿一起接受二审；只有这版正式发布后，且员工有权阅读该资料时，才会出现在更新日志。留空则只显示资料标题。','Optional, up to 600 characters. This note goes through review with the draft. After publication, only readers with access see it in the update log. Leave it blank to show just the article title.')}</p></fieldset></section><section hidden={settingsSection!=='categories'} data-section="categories"> {frozen?<ArticleCategories options={data?.categoryOptions} ids={data?.categoryIds}/>:<CategoryInputs options={categoryOptions} ids={categoryIds} disabled={frozen} onChange={setCategoryIds}/>}
</section><section hidden={settingsSection!=='files'} data-section="files"> <fieldset disabled={frozen||uploading}><legend>{t('私有文件与封面','Private files and cover')}</legend><label className="editor-upload-control"><span>{uploading?t('正在上传…','Uploading…'):t('选择文件上传','Choose a file to upload')}</span><input aria-label={t('上传文件','Upload file')} type="file" disabled={!data} accept=".png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mp3,.ogg,.pdf,.txt,.csv" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void upload(f).catch(()=>{});}}/></label>{!data&&<p>{t('填写标题并等候草稿保存后，即可上传文件。','Add a title and wait for the draft to save before uploading files.')}</p>}<label>{t('选择本篇文件','File attached to this article')}<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">{t('请选择文件','Choose a file')}</option>{assets.filter(a=>a.status==='ready').map(a=><option key={a.id} value={a.id}>{a.filename}</option>)}</select></label><div className="media-toolbar"><button type="button" disabled={!selected} onClick={()=>{const a=assets.find(a=>a.id===selected);if(a)add(a.mime.startsWith('image/')?'image':a.mime.startsWith('video/')?'video':a.mime.startsWith('audio/')?'audio':'file');}}>{t('插入文件到正文','Insert file into article')}</button><button type="button" disabled={!selected||!assets.some(a=>a.id===selected&&a.mime.startsWith("image/"))} onClick={()=>add("image",true)}>{t('插入主题图片','Insert light and dark image')}</button></div><label>{t('文章封面','Article cover')}<select value={cover?.assetId??''} onChange={e=>setCover(e.target.value?{assetId:e.target.value,alt:'',position:50}:null)}><option value="">{t('不使用封面','No cover')}</option>{assets.filter(a=>a.status==='ready'&&a.mime.startsWith('image/')).map(a=><option key={a.id} value={a.id}>{a.filename}</option>)}</select></label>{cover&&<><label>{t('封面替代文字','Cover alt text')}<input value={cover.alt} maxLength={200} onChange={e=>setCover({...cover,alt:e.target.value})}/></label><label>{t('封面位置','Cover position')}<input type="range" min={0} max={100} value={cover.position} onChange={e=>setCover({...cover,position:Number(e.target.value)})}/></label></>}</fieldset>
</section><section hidden={settingsSection!=='fields'} data-section="fields"> {frozen?<FieldValues fields={data?.customFields}/>:<FieldInputs definitions={definitions} previous={initial?.customFields??[]} values={fieldInputs} onChange={(id,value)=>setFieldInputs(old=>({...old,[id]:value}))} disabled={frozen}/>}
</section><section hidden={settingsSection!=='actions'} data-section="actions"><button type="button" disabled={frozen||state.busy||!state.dirty||Boolean(validation)} onClick={()=>{if(conflict){settingsDialog.current?.close();setSettingsOpen(false);recoveryRead.current?.click();return;}void saver.save(true);}}>{conflict?t('查看最新版本并对照','Compare with latest version'):state.error?t('重试保存','Try saving again'):t('立即保存','Save now')}</button><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(copy);showNotice(t('当前输入已复制。','Current input copied.'),'success');}catch{showNotice(t('无法复制，请保留此页面并手动复制输入。','Could not copy. Keep this page open and copy your input manually.'),'error');}}}>{t('复制当前输入','Copy current input')}</button><button type="button" disabled={state.busy} onClick={async()=>{if(!mustWarn||await confirmAction(t('刷新会清除页面内未保存输入及恢复备份，确定继续？','Reloading clears unsaved input and recovery backups. Continue?'),t('重新载入文章？','Reload article?'))){leaving.current=true;window.location.reload();}}}>{t('重新载入','Reload')}</button> {data&&!reviewLocked&&<p className="editor-review-link"><a href={`/admin/review?article=${encodeURIComponent(documentId)}`}>{t('查看二审详情与退回原因','Review details and requested changes')}</a><a href={`/admin/availability?article=${encodeURIComponent(documentId)}`}>{t('归档与下线','Archive or unpublish')}</a><a href={`/admin/history?article=${encodeURIComponent(documentId)}`}>{t('历史记录与版本','History and versions')}</a>{data.status==='changes_requested'&&t(' · 请先按退回原因修改并保存，再重新提交二审。',' · Make the requested changes, save, then submit again.')}</p>} {data&&<DocumentTrashAction id={documentId} title={title} sequence={sequence??data.sequence} disabled={dirty||state.busy||uploading||reviewLocked||data.lifecycle!=='active'} onBusy={setDeleting} onDeleted={sequence=>{setData({...data,sequence,lifecycle:'trashed',status:'draft',publishedRevision:null});}}/>}</section></div></dialog>
 </section>;
}
function providedLabel(data:EditorData|null){return data?'编辑文章':'新建文章';}
