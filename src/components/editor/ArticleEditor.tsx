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
 return <>{backups.map((backup,index)=><InputBackup key={index} value={backup} label={`载入前的输入备份 ${index+1}`}/>)}<ReadyEditor recoveryOwner={recoveryOwner} categoryOptions={initial?.categoryOptions??categoryOptions} key={active.generation} initial={initial} newReference={newReference} newQa={newQa} newOps={newOps} newTranslation={newTranslation} fieldDefinitions={initial?.fieldDefinitions??fieldDefinitions} nodes={nodes} hasBackups={backups.length>0} onLoad={(next,copy)=>{window.history.replaceState(null,'',`/admin/editor?article=${encodeURIComponent(next.documentId)}`);setBackups(old=>[...old,copy]);setActive(old=>({initial:next,generation:old.generation+1}));}}/></>;
}
function ReadyEditor({recoveryOwner,initial,newReference,newQa,newOps,newTranslation,fieldDefinitions,categoryOptions,nodes,hasBackups,onLoad}:{initial:EditorData|null;recoveryOwner:string;newReference:boolean;newQa:boolean;newOps:boolean;newTranslation?:NewTranslation;fieldDefinitions:FieldDefinition[];categoryOptions:CategoryDefinition[];nodes:EditorBlock[];hasBackups:boolean;onLoad:(data:EditorData,copy:string)=>void}){
 const [documentId]=useState(()=>initial?.documentId??(()=>{try{return newTranslation?crypto.randomUUID():newRecoveryId(localStorage,recoveryOwner,newQa?'qa':newOps?'ops':newReference?'reference':'article');}catch{return crypto.randomUUID();}})());
 const locale=initial?.locale??(newTranslation?'en':'zh-CN');const translationOf=initial?.translationOf??newTranslation?.sourceId??null;
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
 const [validation,setValidation]=useState(()=>{if(initial&&(initial.status==='in_review'||initial.lifecycle!=='active'))return '';try{fieldPayload();return '';}catch{return '请检查自定义资料的必填项、类型或选项。原有值已保留。';}});const [uploading,setUploading]=useState(false);const [,redraw]=useState(0);const [preview,setPreview]=useState(false);const [theme,setTheme]=useState<'light'|'dark'>('light');
 const titleElement=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{const el=titleElement.current;if(!el)return;const resize=()=>{el.style.height='auto';el.style.height=el.scrollHeight+'px';};resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();},[title]);
 const settingsDialog=useRef<HTMLDialogElement>(null);const settingsTrigger=useRef<HTMLButtonElement>(null);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [settingsSection,setSettingsSection]=useState('');
 const panelNames:Record<string,string>={basic:'阅读范围与资料',release:'更新说明',categories:'选择文章分类',files:'封面与附件',fields:'自定义字段',actions:'保存与管理'};
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
  if(!await confirmAction(`本篇使用的共用片段将换成第 ${fragment.version} 版；插入块内的手动修改会被替换。当前改动仍要保存并二审发布，确定继续？`,'在本篇采用片段新版？'))return false;
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
  if(selection.empty||!editor.getSelectedText().trim()){setAnnotationError('先选中正文里需要解释的文字。');return;}
  if(!selection.$from.sameParent(selection.$to)||editor.getSelectedText().length>200){setAnnotationError('一次只可注释同一段里不超过 200 字的文字。');return;}
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
  }catch{setAnnotationError('请填写注释，最多 500 个字。');}
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
  }catch(error){setInlineError(error instanceof Error&&error.message==='IMAGE_REQUIRED'?'先选择本篇已上传的图片。':'请检查图标、公式或图片资料后重试。');}
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
 },()=>redraw(n=>n+1),result=>{setData(result);showNotice('草稿已保存。正式版本仍需审核发布后才会更新。','success',false);window.history.replaceState(null,'',`/admin/editor?article=${encodeURIComponent(documentId)}`);}));
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
   saver.update(content);setValidation(!content.title?'请填写文章标题，才能保存。':'');setNotice(null);
  }catch(error){setValidation(validationError(error instanceof Error?error.message:'INVALID_INPUT'));}
 });
 useEffect(()=>editor.onChange(()=>touch()),[editor]);
 const first=useRef(true);useEffect(()=>{if(first.current){first.current=false;return;}touch();},[title,description,releaseNote,kind,audience,tags,cover,iconKey,qaCategory,qaPosition,fieldInputs,categoryIds]);
 const leaving=useRef(false);const state=saver.state;const conflict=['CONFLICT','FIELD_CONFLICT','INVALID_STATE','INACTIVE_DOCUMENT'].includes(state.error);const sequence=data?.sequence??state.sequence;const dirty=state.dirty||Boolean(validation);const mustWarn=dirty||hasBackups||reviewLocked;
 useEffect(()=>{if(state.error)notify(saveError(state.error),'error');},[state.error]);
 useEffect(()=>{if(!mustWarn&&!state.busy)return;const warn=(e:BeforeUnloadEvent)=>{if(leaving.current)return;e.preventDefault();e.returnValue='';};const link=async(e:MouseEvent)=>{const a=(e.target as Element).closest?.('a[href]') as HTMLAnchorElement|null;if(!a||e.defaultPrevented||a.closest('.bn-editor[contenteditable="true"]')||a.target==='_blank'||e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();e.stopPropagation();if(await confirmAction('页面有未保存输入或恢复备份，确定离开吗？','离开编辑页？')){leaving.current=true;window.location.assign(a.href);}};window.addEventListener('beforeunload',warn);document.addEventListener('click',link,true);return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',link,true);};},[mustWarn,state.busy]);
 useEffect(()=>{if(recoveryHold||!state.dirty||state.busy||state.blocked||validation||frozen)return;const timer=setTimeout(()=>void saver.save(),1200);return()=>clearTimeout(timer);},[recoveryHold,saver,state.dirty,state.busy,state.blocked,validation,frozen,title,description,releaseNote,tags,kind,audience,cover,qaCategory,qaPosition,fieldInputs,categoryIds,editor.document]);
 useEffect(()=>{const update=()=>setTheme(document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');update();const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});const system=matchMedia('(prefers-color-scheme: dark)');system.addEventListener('change',update);return()=>{observer.disconnect();system.removeEventListener('change',update);};},[]);
 function add(type:MediaBlock['type'],advanced=false){
  const cursor=editor.getTextCursorPosition().block;
  if(type==='table'){if(advanced){const id=crypto.randomUUID();editor.insertBlocks([{id,type:'juyu',props:{payload:JSON.stringify({id,type:'table',headers:['项目','说明'],rows:[['','']],view:'grid',searchable:true})}}],cursor,'after');}else editor.insertBlocks([{type:'table',content:{type:'tableContent',rows:[{cells:[['项目'],['说明']]},{cells:[[''],['']]}]}}],cursor,'after');return;}
  if(type==='code'){
   if(advanced){const id=crypto.randomUUID();editor.insertBlocks([{id,type:'juyu',props:{payload:JSON.stringify({id,type:'code',language:'text',code:'',lineNumbers:true,wrap:false,expandable:false,collapsedLines:10})}}],cursor,'after');return;}
   const [block]=editor.insertBlocks([{type:'codeBlock'}],cursor,'after');editor.setTextCursorPosition(block,'start');editor.focus();return;
  }
  if(type==='image'||type==='video'||type==='audio'||type==='file'){const asset=assets.find(a=>a.id===selected&&a.status==='ready');if(asset){if(type==='image'&&advanced){const id=crypto.randomUUID();editor.insertBlocks([{id,type:'juyu',props:{payload:JSON.stringify({id,type:'image',assetId:asset.id,caption:'',alt:asset.filename,darkAssetId:null})}}],cursor,'after');}else editor.insertBlocks([{type,props:{url:'/api/assets/'+asset.id,name:asset.filename}}],cursor,'after');}return;}
  const id=crypto.randomUUID();const block:MediaBlock=type==='hint'?{id,type,style:'info',title:'',body:''}:type==='tabs'?{id,type,tabs:[{id:crypto.randomUUID(),title:'标签 1',body:''}]}:type==='steps'?{id,type,steps:[{id:crypto.randomUUID(),title:'第一步',body:''}]}:type==='columns'?{id,type,columns:[{id:crypto.randomUUID(),title:'左栏',body:''},{id:crypto.randomUUID(),title:'右栏',body:''}]}:type==='articleReference'?{id,type,targetId:''}:type==='button'?{id,type,label:'打开资料',href:'',variant:'primary'}:type==='externalEmbed'?{id,type,url:'',caption:''}:{id,type,source:type==='math'?'x^2':'flowchart TD\n A[提交] --> B[审核]',caption:''};
  editor.insertBlocks([{id,type:'juyu',props:{payload:JSON.stringify(block)}}],cursor,'after');
 }
 async function upload(file:File):Promise<string>{
  if(frozen||!data){showNotice('请先填写标题并保存草稿，再上传文件。','error');throw new Error('SAVE_DRAFT_FIRST');}
  const rule=uploadExtensions[file.name.split('.').pop()?.toLowerCase()??''];
  if(!rule||!file.size||file.size>rule.max*1024*1024){showNotice('文件格式或大小不符合要求。图片5MB、影片50MB、音频/PDF20MB、TXT/CSV5MB。','error');throw new Error('INVALID_UPLOAD');}
  uploadCount.current++;setUploading(true);
  try{const r=await fetch(`/api/admin/media/${encodeURIComponent(documentId)}/upload`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file,signal:AbortSignal.timeout(100000)});const a=await r.json();if(!r.ok||a.status!=='ready'||!privateAssetId('/api/assets/'+a.id))throw new Error('UPLOAD_FAILED');setAssets(old=>[a as ManagedAsset,...old]);setSelected(a.id);showNotice('文件已上传。','success');return `/api/assets/${a.id}`;}
  catch{showNotice('上传未确认成功，请重试或重新载入核对文件列表。','error');throw new Error('UPLOAD_FAILED');}finally{uploadCount.current--;setUploading(uploadCount.current>0);}
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
  showNotice(source?`${source.provider} 链接已转成外部内容。员工点击后才会加载。`:'网址已转成外部链接卡片。员工点击后才会打开网站。','success');
 }
 useEffect(()=>{uploadRef.current=upload;});
 let body='';try{body=encodeEditorBody(editorSnapshot(editor.document));}catch{}
 const previewDocument=body?parseReaderBody(body):null;
 const outlineSections=previewDocument?.sections??[];
 const outlineDepth=Math.min(...outlineSections.map(section=>section.depth),6);
 const copy=recoveryText({documentId,sequence,locale,translationOf,categoryIds,categoryOptions,fieldInputs,fieldDefinitions:definitions,savedCustomFields:initial?.customFields??[],title,description,releaseNote,kind,audience,tags,cover,...(kind==='qa'?{qa:{category:qaCategory,position:qaPosition}}:{}),body:editor.document});
 return <section className={`article-editor editor-focused${preview?' is-previewing':''}`} aria-label="文章编辑器">
 <div className="editor-toolbar"><a className="editor-back" href={kind==='qa'?'/admin?kind=qa&view=list':'/admin'}><ArrowLeft size={17}/>{kind==='qa'?'Q&A 管理':'内容管理'}</a><span className="editor-page-label">{locale==='en'?'English version':kind==='qa'?(data?'编辑问答':'新建问答'):providedLabel(data)}</span>{data&&<a className="editor-language-link" href={locale==='en'?`/admin/editor?article=${encodeURIComponent(translationOf!)}`:data.translation?`/admin/editor?article=${encodeURIComponent(data.translation.documentId)}`:`/admin/editor?translate=${encodeURIComponent(documentId)}`}>{locale==='en'?'查看中文原稿':data.translation?'编辑英文版':'撰写英文版'}</a>}<p role="status" className={state.error?'save-state has-error':'save-state'}>{state.busy?'正在保存…':state.error?saveError(state.error):dirty?'有未保存修改':data?'所有修改已保存':'草稿 · 自动保存'}</p>
 <div className="editor-toolbar-actions">{(state.error||recoveryHold)&&<button type="button" disabled={frozen||state.busy||!state.dirty||Boolean(validation)} onClick={()=>{if(conflict){recoveryRead.current?.click();return;}setRecoveryHold(false);void saver.save(true);}}>{conflict?'查看最新版本并对照':state.error?'重试保存':'立即保存'}</button>}<button type="button" className="editor-preview-toggle" aria-pressed={preview} onClick={()=>setPreview(v=>!v)}><Eye size={17}/>{preview?'关闭草稿预览':'预览草稿'}</button><button type="button" disabled={frozen} onMouseDown={event=>event.preventDefault()} onClick={openAnnotation}>添加行内注释</button><button type="button" disabled={frozen} onMouseDown={event=>event.preventDefault()} onClick={openInline}>插入行内元素</button><button type="button" disabled={frozen} onMouseDown={event=>event.preventDefault()} onClick={openFragments}>共用片段</button><button type="button" ref={settingsTrigger} aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={()=>openSettings()}><Gear size={17}/>{kind==='qa'?'问答设置':'文章设置'}</button>{(!data||data.lifecycle==='active')&&<SubmitReview compact id={documentId} sequence={sequence} disabled={dirty||state.busy||uploading||frozen||!data||Boolean(data&&data.status!=='draft')} onLock={setReviewLocked} onSubmitted={result=>{setData(current=>current?{...current,sequence:result.sequence,status:'in_review'}:current);}}/>}</div></div>
 <div className="editor-notices">
 {locale==='zh-CN'&&data&&<p className="editor-translation-note">英文版：{!data.translation?'未开始':data.translation.publishedRevision!==null?'已发布':data.translation.status==='in_review'?'待审核':data.translation.status==='changes_requested'?'待修改':'草稿'}。英文内容需要单独撰写、审核和发布。</p>}
 {locale==='en'&&<p className="editor-translation-note">英文版与中文原稿分别保存、审核和发布。请按自然英语重新撰写标题、说明与步骤；这里不会自动翻译中文内容。{newTranslation&&<> 中文原稿：{newTranslation.sourceTitle}。</>}</p>}
 {recoveryHold&&<p role="status">已恢复输入，自动保存已暂停。请核对后点击立即保存。</p>}
 <LocalRecovery owner={recoveryOwner} id={documentId} sequence={sequence} text={copy} dirty={dirty} blocked={frozen||state.busy||state.blocked} onRestore={raw=>{
 const v=JSON.parse(raw);if(v.documentId!==documentId||(v.locale??'zh-CN')!==locale||(v.translationOf??null)!==translationOf||typeof v.title!=='string'||typeof v.tags!=='string'||!Object.hasOwn(kinds,v.kind)||!['staff','ops','admin'].includes(v.audience)||!Array.isArray(v.body))throw Error('INVALID_RECOVERY');
 const restored=editorSnapshot(v.body);if(data&&v.kind!==data.kind)throw Error('INVALID_RECOVERY');
 setRecoveryHold(true);setTitle(v.title);setDescription(typeof v.description==='string'?v.description:'');setReleaseNote(typeof v.releaseNote==='string'?v.releaseNote:'');setKind(v.kind);setAudience(v.audience);setTags(v.tags);setCover(v.cover);setCategoryIds(normalizeCategoryIds(v.categoryIds));setFieldInputs(v.fieldInputs??{});setQaCategory(v.qa?.category??'');setQaPosition(String(v.qa?.position??0));editor.replaceBlocks(editor.document,toCanvasBlocks(restored as EditorBlock[]) as typeof editorSchema.PartialBlock[]);
 }}/>

 {state.error&&<EditorRecovery readButtonRef={recoveryRead} documentId={documentId} sequence={sequence} busy={state.busy||uploading||frozen} copy={copy} onLoad={next=>{if(!frozen)onLoad(next,copy);}}/>}
 {validation&&validation!=='请填写文章标题，才能保存。'&&<p role="alert">{validation}</p>}{frozen&&<p role="alert">{reviewLocked?'正在核对二审提交结果，编辑暂时暂停。请在二审窗口完成核对。':data?.status==='in_review'?'已提交二审，本次版本暂时锁定。已有正式版本继续可读。':'当前内容已停用，不能编辑。请先完成相应流程。'}</p>}{notice?.toast&&<p role={notice.tone==='error'?'alert':'status'}>{notice.message}</p>}{data&&(data.publishedRevision!==null||data.status!=='draft')&&<p className="editor-published-note">{publicationLabel({publicationNumber:data.publicationNumber,revision:0,publishedRevision:data.publishedRevision,status:data.status as 'draft'})}</p>}
 {data&&data.publishedRevision!==null&&<p className="editor-publication-guidance">修改会保存为新草稿，旧正式版继续可读；新稿需要重新二审和发布。</p>}

 </div><div className="editor-workarea"><div className="editor-writing"><div className="editor-document-heading">{kind!=='qa'&&<button className="editor-cover-trigger" type="button" onClick={()=>openSettings('files')}><ImageSquare size={17}/>{cover?'管理封面':'添加封面'}</button>}<span className="editor-draft-label">{{draft:'草稿',in_review:'等待二审',changes_requested:'需要修改',approved:'已经批准',queued:'等待发布',published:'已经发布'}[data?.status??'draft']??data?.status}</span><label className="editor-title-label"><span className="sr-only">文章标题</span><textarea ref={titleElement} aria-label={kind==='qa'?'问题':'文章标题'} placeholder={kind==='qa'?'输入员工会问的问题':'请输入文章标题'} rows={1} maxLength={200} disabled={frozen} value={title} onChange={e=>setTitle(e.target.value)}/></label>{kind!=='qa'&&<label className="editor-description-label"><span className="sr-only">文章简介</span><textarea aria-label="文章简介" placeholder="用一句话说明这篇资料能帮助员工解决什么问题（选填）" rows={2} maxLength={300} disabled={frozen} value={description} onChange={e=>setDescription(e.target.value)}/><small>{Array.from(description).length}/300 · 审核发布后才会显示</small></label>}{!title.trim()&&<p className="editor-title-hint">{kind==='qa'?'先填写问题，再在下方编写标准答案。':'先给文章起个标题，之后修改会自动保存。'}</p>}<div className="editor-metadata-summary">{kind==='qa'?<label className="qa-editor-category">问答分类<input aria-label="问答分类" maxLength={80} disabled={frozen} value={qaCategory} placeholder="例如：账户问题" onChange={e=>setQaCategory(e.target.value)}/></label>:<button type="button" onClick={()=>openSettings('categories')}>{categoryIds.length?'分类：'+categoryIds.map(id=>categoryOptions.find(c=>c.id===id)?.name??'原有分类').slice(0,2).join('、')+(categoryIds.length>2?` 等 ${categoryIds.length} 项`:''):'添加分类'}</button>}<button type="button" onClick={()=>openSettings('basic')}>谁可以阅读：{{staff:'全体员工',ops:'运营和管理员',admin:'仅管理员'}[audience]}</button><button type="button" aria-label="更多文章设置" onClick={()=>openSettings()}>更多设置</button></div></div>
 {(kind==='article'||kind==='ops')&&<div className="editor-outline-guidance"><p className="editor-outline-status">{outlineSections.length?`本页目录 · ${outlineSections.length} 个标题，可在草稿预览中查看。`:'本页目录尚未生成。将正文小标题设为“标题”；只加粗不会进入目录。'}</p><details className="editor-outline-help"><summary>如何设置标题？</summary><div><p>在正文新的一行输入 <code>/</code>，选择“一级标题”“二级标题”或“三级标题”。已有文字可通过段落左侧菜单改成标题。</p><p>标题按层级生成右侧目录；只把文字<strong>加粗</strong>，不会生成目录。页面顶部的文章名称也不是正文小标题。</p><p>左侧的主分类、子分类在“添加分类”中设置，与正文标题分开管理。写好后打开“预览草稿”检查层级；正式页面在二审发布后更新。</p></div></details></div>}
 {inlineOpen&&<div className="editor-annotation-composer editor-inline-composer" role="dialog" aria-label="插入行内元素"><label>元素类型<select aria-label="行内元素类型" value={inlineType} onChange={event=>{setInlineType(event.target.value as typeof inlineType);setInlineError('');}}><option value="icon">小图标</option><option value="math">数学公式</option><option value="image">行内图片</option></select></label>{inlineType==='icon'&&<label>图标<select aria-label="行内图标" value={inlineIcon} onChange={event=>setInlineIcon(event.target.value as ReaderIconKey)}>{Object.entries(readerIconLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}{inlineType==='math'&&<label>公式内容<input aria-label="行内公式" maxLength={350} value={inlineFormula} onChange={event=>setInlineFormula(event.target.value)} placeholder="例如 x^2+y^2"/></label>}{inlineType==='image'&&<><label>已上传图片<select aria-label="行内图片" value={inlineImage} onChange={event=>setInlineImage(event.target.value)}><option value="">请选择图片</option>{assets.filter(asset=>asset.status==='ready'&&asset.mime.startsWith('image/')).map(asset=><option key={asset.id} value={asset.id}>{asset.filename}</option>)}</select></label><label>图片说明<input aria-label="行内图片说明" maxLength={100} value={inlineAlt} onChange={event=>setInlineAlt(event.target.value)} placeholder="让员工知道图片内容"/></label>{!assets.some(asset=>asset.status==='ready'&&asset.mime.startsWith('image/'))&&<p>先在文章设置中上传图片，保存草稿后再插入。</p>}</>}{inlineError&&<p role="alert">{inlineError}</p>}<div><button type="button" onClick={()=>{setInlineOpen(false);inlineSelection.current=null;}}>取消</button><button type="button" onClick={insertInline}>插入正文</button></div></div>}
 <EditorContext.Provider value={{documentId,assets,frozen,locale}}><div className="editor-canvas" onPasteCapture={pasteExternalEmbed}>{kind==='qa'&&<p className="qa-answer-label">{locale==='en'?'Answer':'标准答案'}</p>}{annotationError&&!annotationOpen&&<p role="alert" className="editor-annotation-error">{annotationError}</p>}{annotationOpen&&<div className="editor-annotation-composer" role="dialog" aria-label="添加行内注释"><label>注释内容<textarea aria-label="注释内容" rows={3} maxLength={500} value={annotationNote} onChange={event=>{setAnnotationNote(event.target.value);setAnnotationError('');}} placeholder="员工点击文字时看到的解释"/></label>{annotationError&&<p role="alert">{annotationError}</p>}<div><button type="button" onClick={()=>{setAnnotationOpen(false);annotationSelection.current=null;setAnnotationError('');}}>取消</button><button type="button" disabled={!annotationNote.trim()||frozen} onClick={insertAnnotation}>插入注释</button></div></div>}<BlockNoteView editor={editor} editable={!frozen} theme={theme} slashMenu={false}>
  <SuggestionMenuController triggerCharacter="/" getItems={async query=>{
   const extra=([['hint','提示框'],['tabs','分页标签'],['steps','操作步骤'],['columns','分栏布局'],['articleReference','引用文章'],['button','操作按钮'],['externalEmbed','外部内容'],['math','数学公式'],['diagram','流程图']] as const).map(([type,title])=>({title,group:'扩展内容',aliases:[type],onItemClick:()=>add(type)}));
   return [...getDefaultReactSlashMenuItems(editor),...extra,{title:'资料表格',group:'扩展内容',aliases:['table','表格','筛选'],onItemClick:()=>add('table',true)},{title:'代码示例',group:'扩展内容',aliases:['code','代码','文件名','行号'],onItemClick:()=>add('code',true)}].filter(item=>[item.title,...(item.aliases??[])].some(text=>text.toLowerCase().includes(query.toLowerCase())));
  }}/>
 </BlockNoteView></div></EditorContext.Provider>
 {fragmentsOpen&&<ReusableFragmentDialog selection={fragmentSelection} usages={fragmentUsages} onInsert={insertFragment} onRefresh={refreshFragment} onClose={()=>setFragmentsOpen(false)}/>}
 </div>{preview&&<section className="editor-preview" aria-label={locale==='en'?'Publication preview':'发布效果预览'}><div className="editor-preview-heading"><strong>{locale==='en'?'Publication preview':'发布效果预览'}</strong><button type="button" aria-label={locale==='en'?'Close preview':'关闭预览'} onClick={()=>setPreview(false)}><X size={18}/></button></div><h2>{title||(locale==='en'?'Untitled draft':'未命名草稿')}</h2>{kind!=='qa'&&description.trim()&&<p className="reader-page-description">{description.trim()}</p>}<p>{locale==='en'?'Draft · Not published':'当前草稿 · 尚未发布'}</p>{(frozen||!validation)&&<FieldValues fields={frozen?data?.customFields:customFields()}/>}{previewDocument?<>{(kind==='article'||kind==='ops')&&<nav className="editor-preview-outline" aria-label={locale==='en'?'On this page preview':'本页内容预览'}><strong>{locale==='en'?'On this page':'本页内容'}</strong>{outlineSections.length?<ol>{outlineSections.map(section=><li key={section.id} style={{paddingInlineStart:(section.depth-outlineDepth)*12}}><button type="button" onClick={event=>{const container=event.currentTarget.closest('.editor-preview');const target=Array.from(container?.querySelectorAll<HTMLElement>('.gitbook-document [id]')??[]).find(element=>element.id===section.id);if(!target)return;for(let parent=target.parentElement;parent&&parent!==container;parent=parent.parentElement){if(parent instanceof HTMLDetailsElement)parent.open=true;}target.scrollIntoView({block:'start',behavior:'auto'});target.focus({preventScroll:true});}}>{section.title||(locale==='en'?'Untitled heading':'未命名标题')}</button></li>)}</ol>:<p>{locale==='en'?'Add a heading to show an on-page outline after publication.':'正文尚未设置标题，发布后不会显示本页目录。'}</p>}</nav>}<DocumentView document={previewDocument} documentId={documentId} locale={locale} admin/></>:<p>{locale==='en'?'Fix the current content to preview it. Your draft is still here.':'当前内容有待修正，预览暂不可用。输入仍保留。'}</p>}</section>}
 </div><dialog ref={settingsDialog} className="editor-settings-drawer" aria-labelledby="editor-settings-title" onClose={()=>{setSettingsOpen(false);settingsTrigger.current?.focus();}}><div className="editor-settings-heading"><h2 id="editor-settings-title">{panelNames[settingsSection]??'文章设置'}</h2><button type="button" aria-label="关闭文章设置" onClick={()=>settingsDialog.current?.close()}><X size={20}/></button></div><div className="editor-settings-content">{settingsSection?<button className="editor-settings-back" type="button" onClick={()=>setSettingsSection('')}><ArrowLeft size={16}/>全部设置</button>:<nav className="editor-settings-menu" aria-label="文章设置项目">{Object.entries(panelNames).map(([key,label])=><button key={key} type="button" onClick={()=>setSettingsSection(key)}><strong>{label}</strong><span>{{basic:'设置资料类型、阅读权限和标签',release:'撰写二审通过后显示的版本说明',categories:'选择文章在资料库中的位置',files:'上传文件，选择文章封面',fields:'填写团队设置的补充资料',actions:'备份输入、查看历史或移入回收站'}[key]}</span></button>)}</nav>}<section hidden={settingsSection!=='basic'} data-section="basic"> <fieldset disabled={frozen}><legend>文章资料</legend><div className="editor-metadata"><label>资料类型<select value={kind} disabled={data!==null||state.busy||newQa||newOps||Boolean(newTranslation)} onChange={e=>{const v=e.target.value as ContentKind;setKind(v);if(v==='ops'&&audience==='staff')setAudience('ops');}}>{Object.entries(kinds).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><label>阅读范围<select value={audience} onChange={e=>setAudience(e.target.value as Audience)}>{kind!=='ops'&&<option value="staff">全体员工（客服、运营、管理员）</option>}<option value="ops">运营和管理员</option><option value="admin">仅管理员</option></select></label><label>文章标签<input maxLength={500} value={tags} onChange={e=>setTags(e.target.value)} placeholder="例如：域名转入，客户验证"/></label></div></fieldset>
 <fieldset disabled={frozen}><legend>目录外观</legend><label>文章目录图标<select aria-label="文章目录图标" value={iconKey??''} onChange={e=>setIconKey(e.target.value?e.target.value as ReaderIconKey:null)}><option value="">默认文件图标</option>{Object.entries(readerIconLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><p className="qa-editor-note">图标随草稿保存，二审发布后员工才会看到。</p></fieldset>
 {kind==='qa'&&<fieldset disabled={frozen}><legend>问题分类与排序</legend><div className="editor-metadata"><label>问答分类<input maxLength={80} value={qaCategory} onChange={e=>setQaCategory(e.target.value)} placeholder="例如：账户问题"/></label><label>问答排序<input type="number" min="0" max="999999" step="1" value={qaPosition} onChange={e=>setQaPosition(e.target.value)}/></label></div><p className="qa-editor-note">标题填写问题，正文填写答案。分类留空表示未分类；排序数字越小越靠前，相同数字按问题标题排序。问答分类只用于查找，不改变既有阅读权限。分类和排序修改也须二审发布。</p></fieldset>}
 </section><section hidden={settingsSection!=='release'} data-section="release"><fieldset disabled={frozen}><legend>本次发布的更新说明</legend><label>员工在更新日志中看到的说明<textarea aria-label="更新说明" rows={5} maxLength={600} value={releaseNote} onChange={event=>setReleaseNote(event.target.value)} placeholder="例如：补充了账户邮箱变更的审核步骤与所需资料。"/></label><p className="qa-editor-note">选填，最多 600 字。它随当前草稿一起接受二审；只有这版正式发布后，且员工有权阅读该资料时，才会出现在更新日志。留空则只显示资料标题。</p></fieldset></section><section hidden={settingsSection!=='categories'} data-section="categories"> {frozen?<ArticleCategories options={data?.categoryOptions} ids={data?.categoryIds}/>:<CategoryInputs options={categoryOptions} ids={categoryIds} disabled={frozen} onChange={setCategoryIds}/>}
</section><section hidden={settingsSection!=='files'} data-section="files"> <fieldset disabled={frozen||uploading}><legend>私有文件与封面</legend><label className="editor-upload-control"><span>{uploading?'正在上传…':'选择文件上传'}</span><input aria-label="上传文件" type="file" disabled={!data} accept=".png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mp3,.ogg,.pdf,.txt,.csv" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void upload(f).catch(()=>{});}}/></label>{!data&&<p>填写标题并等候草稿保存后，即可上传文件。</p>}<label>选择本篇文件<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">请选择文件</option>{assets.filter(a=>a.status==='ready').map(a=><option key={a.id} value={a.id}>{a.filename}</option>)}</select></label><div className="media-toolbar"><button type="button" disabled={!selected} onClick={()=>{const a=assets.find(a=>a.id===selected);if(a)add(a.mime.startsWith('image/')?'image':a.mime.startsWith('video/')?'video':a.mime.startsWith('audio/')?'audio':'file');}}>插入文件到正文</button><button type="button" disabled={!selected||!assets.some(a=>a.id===selected&&a.mime.startsWith("image/"))} onClick={()=>add("image",true)}>插入主题图片</button></div><label>文章封面<select value={cover?.assetId??''} onChange={e=>setCover(e.target.value?{assetId:e.target.value,alt:'',position:50}:null)}><option value="">不使用封面</option>{assets.filter(a=>a.status==='ready'&&a.mime.startsWith('image/')).map(a=><option key={a.id} value={a.id}>{a.filename}</option>)}</select></label>{cover&&<><label>封面替代文字<input value={cover.alt} maxLength={200} onChange={e=>setCover({...cover,alt:e.target.value})}/></label><label>封面位置<input type="range" min={0} max={100} value={cover.position} onChange={e=>setCover({...cover,position:Number(e.target.value)})}/></label></>}</fieldset>
</section><section hidden={settingsSection!=='fields'} data-section="fields"> {frozen?<FieldValues fields={data?.customFields}/>:<FieldInputs definitions={definitions} previous={initial?.customFields??[]} values={fieldInputs} onChange={(id,value)=>setFieldInputs(old=>({...old,[id]:value}))} disabled={frozen}/>}
</section><section hidden={settingsSection!=='actions'} data-section="actions"><button type="button" disabled={frozen||state.busy||!state.dirty||Boolean(validation)} onClick={()=>{if(conflict){settingsDialog.current?.close();setSettingsOpen(false);recoveryRead.current?.click();return;}void saver.save(true);}}>{conflict?'查看最新版本并对照':state.error?'重试保存':'立即保存'}</button><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(copy);showNotice('当前输入已复制。','success');}catch{showNotice('无法复制，请保留此页面并手动复制输入。','error');}}}>复制当前输入</button><button type="button" disabled={state.busy} onClick={async()=>{if(!mustWarn||await confirmAction('刷新会清除页面内未保存输入及恢复备份，确定继续？','重新载入文章？')){leaving.current=true;window.location.reload();}}}>重新载入</button> {data&&!reviewLocked&&<p className="editor-review-link"><a href={`/admin/review?article=${encodeURIComponent(documentId)}`}>查看二审详情与退回原因</a><a href={`/admin/availability?article=${encodeURIComponent(documentId)}`}>归档与下线</a><a href={`/admin/history?article=${encodeURIComponent(documentId)}`}>历史记录与版本</a>{data.status==='changes_requested'&&' · 请先按退回原因修改并保存，再重新提交二审。'}</p>} {data&&<DocumentTrashAction id={documentId} title={title} sequence={sequence??data.sequence} disabled={dirty||state.busy||uploading||reviewLocked||data.lifecycle!=='active'} onBusy={setDeleting} onDeleted={sequence=>{setData({...data,sequence,lifecycle:'trashed',status:'draft',publishedRevision:null});}}/>}</section></div></dialog>
 </section>;
}
function providedLabel(data:EditorData|null){return data?'编辑文章':'新建文章';}
