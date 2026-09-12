'use client';
import {LocalRecovery} from './LocalRecovery';
import {newRecoveryId} from '../../editor/local-recovery';
import {confirmAction,notify} from '../feedback/feedback';
import {Gear,Eye,X,ImageSquare,ArrowLeft} from '@phosphor-icons/react';
import {SyntaxHighlightingExtension} from '@blocknote/core/extensions';
import {codeHighlighter} from '../../editor/highlight';
import {nativeEditorContent} from '../../editor/native';
import {safeLink} from '../../editor/inline';
import {useEffect,useEffectEvent,useRef,useState} from 'react';
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
import {zh} from '@blocknote/core/locales';
import '@blocknote/mantine/style.css';
import type {EditorData,SaveDraftInput} from '../../editor/contract';
import {editorInitialContent} from '../../editor/legacy';
import {encodeEditorBody,privateAssetId,type EditorBlock} from '../../editor/document';
import {DraftSaver,DraftSaveRejected} from '../../editor/autosave';
import {editorSchema,createEditorSchema,editorSnapshot,EditorContext} from './schema';
import {normalizePresentation} from '../../domain/presentation';
import {uploadExtensions,type ManagedAsset,type MediaBlock} from '../../media/model';
import {kinds,publicationLabel} from '../../workspace/model';
import type {Audience,ContentKind} from '../../domain/model';
import {parseReaderBody} from '../../reader/body';
import {DocumentView} from '../gitbook/Reading/DocumentView';
import {SubmitReview} from '../review/SubmitReview';
import {DocumentTrashAction} from '../lifecycle/DocumentTrashAction';
import {EditorRecovery,InputBackup} from './EditorRecovery';
import {recoveryText} from '../../editor/recovery';
type Content=Omit<SaveDraftInput,'expectedSequence'>;
function saveError(code:string){return code==='FIELD_CONFLICT'?'字段设置已更新。输入仍保留，请先复制备份并重新读取最新设置后核对。':code==='CONFLICT'?'另一位管理员或另一个页面已保存修改。你的输入仍保留，可在下方对照最新版本；不会覆盖服务器版本。':code==='INVALID_STATE'||code==='INACTIVE_DOCUMENT'?'当前文章已进入审核或无法编辑。你的输入仍保留，可在下方读取最新状态并保留备份。':code==='FORBIDDEN'?'你的管理权限已改变。输入仍保留，保存已停止。':'保存尚未确认，输入仍保留。请检查内容或网络后重试。';}
export default function ArticleEditor({initial:provided,recoveryOwner='',newReference=false,newQa=false,newOps=false,fieldDefinitions=[],categoryOptions=[]}:{initial:EditorData|null;recoveryOwner?:string;newReference?:boolean;newQa?:boolean;newOps?:boolean;fieldDefinitions?:FieldDefinition[];categoryOptions?:CategoryDefinition[]}){
 const [active,setActive]=useState({initial:provided,generation:0});const [backups,setBackups]=useState<string[]>([]);const initial=active.initial;
 let nodes:EditorBlock[];try{nodes=nativeEditorContent(editorInitialContent(initial?.body??'',initial?.blocks??[]),initial?.assets??[]);}catch{return <section role="alert"><h2>暂时无法载入编辑内容</h2><p>原文仍保留。请返回列表检查资料，避免覆盖内容。</p><textarea readOnly aria-label="保留的正文" value={initial?.body??''}/></section>;}
 return <>{backups.map((backup,index)=><InputBackup key={index} value={backup} label={`载入前的输入备份 ${index+1}`}/>)}<ReadyEditor recoveryOwner={recoveryOwner} categoryOptions={initial?.categoryOptions??categoryOptions} key={active.generation} initial={initial} newReference={newReference} newQa={newQa} newOps={newOps} fieldDefinitions={initial?.fieldDefinitions??fieldDefinitions} nodes={nodes} hasBackups={backups.length>0} onLoad={(next,copy)=>{window.history.replaceState(null,'',`/admin/editor?article=${encodeURIComponent(next.documentId)}`);setBackups(old=>[...old,copy]);setActive(old=>({initial:next,generation:old.generation+1}));}}/></>;
}
function ReadyEditor({recoveryOwner,initial,newReference,newQa,newOps,fieldDefinitions,categoryOptions,nodes,hasBackups,onLoad}:{initial:EditorData|null;recoveryOwner:string;newReference:boolean;newQa:boolean;newOps:boolean;fieldDefinitions:FieldDefinition[];categoryOptions:CategoryDefinition[];nodes:EditorBlock[];hasBackups:boolean;onLoad:(data:EditorData,copy:string)=>void}){
 const [documentId]=useState(()=>initial?.documentId??(()=>{try{return newRecoveryId(localStorage,recoveryOwner,newQa?'qa':newOps?'ops':newReference?'reference':'article');}catch{return crypto.randomUUID();}})());
 const [data,setData]=useState(initial);const [title,setTitle]=useState(initial?.title??'');const [kind,setKind]=useState<ContentKind>(initial?.kind??(newQa?'qa':newOps?'ops':newReference?'reference':'article'));const [audience,setAudience]=useState<Audience>(initial?.audience??(newOps?'ops':'staff'));
 const [categoryIds,setCategoryIds]=useState(()=>normalizeCategoryIds(initial?.categoryIds));
 const [definitions]=useState(fieldDefinitions);const [prepared]=useState(()=>prepareFieldSnapshots(definitions,initial?.customFields??[]));
 const [fieldInputs,setFieldInputs]=useState<Record<string,string>>(()=>Object.fromEntries(prepared.map(f=>[f.id,f.value===null?'':String(f.value)])));
 const customFields=()=>prepared.map(f=>definitions.some(d=>d.id===f.id&&d.enabled)?{...f,value:fieldInputValue(f.type,fieldInputs[f.id]??'')}:f);
 const fieldPayload=()=>{const values=customFields();validateFieldSnapshots(definitions,values,initial?.customFields??[]);return values.length?{customFields:values}:{};};
 const [qaCategory,setQaCategory]=useState(initial?.qa?.category??'');const [qaPosition,setQaPosition]=useState(String(initial?.qa?.position??0));
 const [tags,setTags]=useState(initial?.tags.join(', ')??'');const [cover,setCover]=useState(initial?.cover??null);const [assets,setAssets]=useState(initial?.assets??[]);const [selected,setSelected]=useState('');
 const [recoveryHold,setRecoveryHold]=useState(false);
 const [notice,setNotice]=useState('');const [validation,setValidation]=useState(()=>{if(initial&&(initial.status==='in_review'||initial.lifecycle!=='active'))return '';try{fieldPayload();return '';}catch{return '请检查自定义资料的必填项、类型或选项。原有值已保留。';}});const [uploading,setUploading]=useState(false);const [,redraw]=useState(0);const [preview,setPreview]=useState(false);const [theme,setTheme]=useState<'light'|'dark'>('light');
 const titleElement=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{const el=titleElement.current;if(!el)return;const resize=()=>{el.style.height='auto';el.style.height=el.scrollHeight+'px';};resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();},[title]);
 useEffect(()=>{if(notice&&!notice.startsWith('草稿已保存'))notify(notice,notice.includes('无法')?'error':'success');},[notice]);
 const settingsDialog=useRef<HTMLDialogElement>(null);const settingsTrigger=useRef<HTMLButtonElement>(null);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [settingsSection,setSettingsSection]=useState('');
 const panelNames:Record<string,string>={basic:'阅读范围与资料',categories:'选择文章分类',files:'封面与附件',fields:'自定义字段',actions:'保存与管理'};
 function openSettings(section=''){setSettingsSection(section);settingsDialog.current?.showModal();setSettingsOpen(true);}
 const uploadCount=useRef(0);
 const [deleting,setDeleting]=useState(false);const [reviewLocked,setReviewLocked]=useState(false);
 const frozen=reviewLocked||deleting||data?.status==='in_review'||(data!==null&&data.lifecycle!=='active');
 const uploadRef=useRef<(file:File)=>Promise<string>>(async()=>{throw new Error('UPLOAD_NOT_READY');});
 const [nativeSchema]=useState(()=>createEditorSchema(nodes));
 const editor=useCreateBlockNote({schema:nativeSchema,dictionary:zh,domAttributes:{editor:{"aria-label":"文章正文"}},
  extensions:[SyntaxHighlightingExtension({createHighlighter:codeHighlighter})],
  links:{isValidLink:safeLink},initialContent:nodes as typeof editorSchema.PartialBlock[],
  tables:{splitCells:true,cellBackgroundColor:true,cellTextColor:true,headers:true},
  uploadFile:async(file)=>uploadRef.current(file),
  resolveFileUrl:async(url)=>{const id=privateAssetId(url);if(!id)return '';return `/api/admin/assets/${id}`;},
 },[]);
 const initialContent:Content={categoryIds:normalizeCategoryIds(initial?.categoryIds),...(prepared.length?{customFields:prepared}:{}),title:initial?.title??'',body:encodeEditorBody(nodes),kind:initial?.kind??(newQa?'qa':newOps?'ops':newReference?'reference':'article'),audience:initial?.audience??(newOps?'ops':'staff'),tags:initial?.tags??[],cover:initial?.cover??null,...((initial?.kind??(newQa?'qa':newOps?'ops':newReference?'reference':'article'))==='qa'?{qa:normalizeQa(initial?.qa)}:{})};
 const [saver]=useState(()=>new DraftSaver<Content,EditorData>(initialContent,initial?.sequence??null,async(value,sequence)=>{
  const response=await fetch(`/api/admin/editor/${encodeURIComponent(documentId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,expectedSequence:sequence}),signal:AbortSignal.timeout(20000)});const result=await response.json();
  if(!response.ok)throw response.status>=400&&response.status<500?new DraftSaveRejected(result.error??'SAVE_FAILED'):new Error(result.error??'SAVE_FAILED');
  if(result.documentId!==documentId||result.body!==value.body||result.title!==value.title||JSON.stringify(result.tags)!==JSON.stringify(value.tags))throw new Error('INVALID_ACK');
  if(JSON.stringify(normalizeCategoryIds(result.categoryIds))!==JSON.stringify(normalizeCategoryIds(value.categoryIds)))throw new Error('INVALID_ACK');
  if(value.kind==='qa'&&JSON.stringify(normalizeQa(result.qa))!==JSON.stringify(normalizeQa(value.qa)))throw new Error('INVALID_ACK');
  if(JSON.stringify(normalizeFieldSnapshots(result.customFields))!==JSON.stringify(normalizeFieldSnapshots(value.customFields)))throw new Error('INVALID_ACK');
  return result;
 },()=>redraw(n=>n+1),result=>{setData(result);setNotice('草稿已保存。正式版本仍需审核发布后才会更新。');window.history.replaceState(null,'',`/admin/editor?article=${encodeURIComponent(documentId)}`);}));
 const touch=useEffectEvent(()=>{if(frozen)return;try{const v={title,kind,audience,tags,cover};if(kind==='qa'&&!/^\d{1,6}$/.test(qaPosition))throw new Error('INVALID_INPUT');const presentation=normalizePresentation({tags:v.tags.split(/[,，]/).map(s=>s.trim()).filter(Boolean),cover:v.cover});const content:Content={categoryIds:categorySelection(categoryOptions,categoryIds,initial?.categoryIds),...fieldPayload(),title:v.title.trim(),body:encodeEditorBody(editorSnapshot(editor.document)),kind:v.kind,audience:v.audience,tags:presentation.tags,cover:presentation.cover,...(kind==='qa'?{qa:normalizeQa({category:qaCategory,position:Number(qaPosition)})}:{})};saver.update(content);setValidation(!content.title?'请填写文章标题，才能保存。':'');setNotice('');}catch(error){setValidation(error instanceof Error&&error.message==='PRIVATE_EDITOR_FILE_REQUIRED'?'图片、影片、音频和附件请上传到本资料库；外部网址可以插入为文字链接。当前输入已保留。':'内容格式或长度超出限制，当前输入已保留，请检查后保存。');}});
 useEffect(()=>editor.onChange(()=>touch()),[editor]);
 const first=useRef(true);useEffect(()=>{if(first.current){first.current=false;return;}touch();},[title,kind,audience,tags,cover,qaCategory,qaPosition,fieldInputs,categoryIds]);
 const leaving=useRef(false);const state=saver.state;const sequence=data?.sequence??state.sequence;const dirty=state.dirty||Boolean(validation);const mustWarn=dirty||hasBackups||reviewLocked;
 useEffect(()=>{if(state.error)notify(saveError(state.error),'error');},[state.error]);
 useEffect(()=>{if(!mustWarn&&!state.busy)return;const warn=(e:BeforeUnloadEvent)=>{if(leaving.current)return;e.preventDefault();e.returnValue='';};const link=async(e:MouseEvent)=>{const a=(e.target as Element).closest?.('a[href]') as HTMLAnchorElement|null;if(!a||e.defaultPrevented||a.closest('.bn-editor[contenteditable="true"]')||a.target==='_blank'||e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();e.stopPropagation();if(await confirmAction('页面有未保存输入或恢复备份，确定离开吗？','离开编辑页？')){leaving.current=true;window.location.assign(a.href);}};window.addEventListener('beforeunload',warn);document.addEventListener('click',link,true);return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',link,true);};},[mustWarn,state.busy]);
 useEffect(()=>{if(recoveryHold||!state.dirty||state.busy||state.blocked||validation||frozen)return;const timer=setTimeout(()=>void saver.save(),1200);return()=>clearTimeout(timer);},[recoveryHold,saver,state.dirty,state.busy,state.blocked,validation,frozen,title,tags,kind,audience,cover,qaCategory,qaPosition,fieldInputs,categoryIds,editor.document]);
 useEffect(()=>{const update=()=>setTheme(document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');update();const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});const system=matchMedia('(prefers-color-scheme: dark)');system.addEventListener('change',update);return()=>{observer.disconnect();system.removeEventListener('change',update);};},[]);
 function add(type:MediaBlock['type']){
  const cursor=editor.getTextCursorPosition().block;
  if(type==='table'){editor.insertBlocks([{type:'table',content:{type:'tableContent',rows:[{cells:[['项目'],['说明']]},{cells:[[''],['']]}]}}],cursor,'after');return;}
  if(type==='code'){const [block]=editor.insertBlocks([{type:'codeBlock'}],cursor,'after');editor.setTextCursorPosition(block,'start');editor.focus();return;}
  if(type==='image'||type==='video'||type==='audio'||type==='file'){const asset=assets.find(a=>a.id===selected&&a.status==='ready');if(asset)editor.insertBlocks([{type,props:{url:'/api/assets/'+asset.id,name:asset.filename}}],cursor,'after');return;}
  const id=crypto.randomUUID();const block:MediaBlock=type==='hint'?{id,type,style:'info',title:'',body:''}:type==='tabs'?{id,type,tabs:[{id:crypto.randomUUID(),title:'标签 1',body:''}]}:{id,type,source:type==='math'?'x^2':'flowchart TD\n A[提交] --> B[审核]',caption:''};
  editor.insertBlocks([{id,type:'juyu',props:{payload:JSON.stringify(block)}}],cursor,'after');
 }
 async function upload(file:File):Promise<string>{
  if(frozen||!data){setNotice('请先填写标题并保存草稿，再上传文件。');throw new Error('SAVE_DRAFT_FIRST');}
  const rule=uploadExtensions[file.name.split('.').pop()?.toLowerCase()??''];
  if(!rule||!file.size||file.size>rule.max*1024*1024){setNotice('文件格式或大小不符合要求。图片5MB、影片50MB、音频/PDF20MB、TXT/CSV5MB。');throw new Error('INVALID_UPLOAD');}
  uploadCount.current++;setUploading(true);
  try{const r=await fetch(`/api/admin/media/${encodeURIComponent(documentId)}/upload`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file,signal:AbortSignal.timeout(100000)});const a=await r.json();if(!r.ok||a.status!=='ready'||!privateAssetId('/api/assets/'+a.id))throw new Error('UPLOAD_FAILED');setAssets(old=>[a as ManagedAsset,...old]);setSelected(a.id);setNotice('文件已上传。');return `/api/assets/${a.id}`;}
  catch{setNotice('上传未确认成功，请重试或重新载入核对文件列表。');throw new Error('UPLOAD_FAILED');}finally{uploadCount.current--;setUploading(uploadCount.current>0);}
 }
 useEffect(()=>{uploadRef.current=upload;});
 let body='';try{body=encodeEditorBody(editorSnapshot(editor.document));}catch{}
 const copy=recoveryText({documentId,sequence,categoryIds,categoryOptions,fieldInputs,fieldDefinitions:definitions,savedCustomFields:initial?.customFields??[],title,kind,audience,tags,cover,...(kind==='qa'?{qa:{category:qaCategory,position:qaPosition}}:{}),body:editor.document});
 return <section className={`article-editor editor-focused${preview?' is-previewing':''}`} aria-label="文章编辑器">
 <div className="editor-toolbar"><a className="editor-back" href={kind==='qa'?'/admin?kind=qa&view=list':'/admin'}><ArrowLeft size={17}/>{kind==='qa'?'Q&A 管理':'内容管理'}</a><span className="editor-page-label">{kind==='qa'?(data?'编辑问答':'新建问答'):providedLabel(data)}</span><p role="status" className={state.error?'save-state has-error':'save-state'}>{state.busy?'正在保存…':state.error?saveError(state.error):dirty?'有未保存修改':data?'所有修改已保存':'草稿 · 自动保存'}</p>
 <div className="editor-toolbar-actions">{(state.error||recoveryHold)&&<button type="button" disabled={frozen||state.busy||!state.dirty||Boolean(validation)} onClick={()=>{setRecoveryHold(false);void saver.save(true);}}>{state.error?'重试保存':'立即保存'}</button>}<button type="button" className="editor-preview-toggle" aria-pressed={preview} onClick={()=>setPreview(v=>!v)}><Eye size={17}/>{preview?'关闭草稿预览':'预览草稿'}</button><button type="button" ref={settingsTrigger} aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={()=>openSettings()}><Gear size={17}/>{kind==='qa'?'问答设置':'文章设置'}</button>{(!data||data.lifecycle==='active')&&<SubmitReview compact id={documentId} sequence={sequence} disabled={dirty||state.busy||uploading||frozen||!data||Boolean(data&&data.status!=='draft')} onLock={setReviewLocked} onSubmitted={result=>{setData(current=>current?{...current,sequence:result.sequence,status:'in_review'}:current);}}/>}</div></div>
 <div className="editor-notices">
 {recoveryHold&&<p role="status">已恢复输入，自动保存已暂停。请核对后点击立即保存。</p>}
 <LocalRecovery owner={recoveryOwner} id={documentId} sequence={sequence} text={copy} dirty={dirty} blocked={frozen||state.busy||state.blocked} onRestore={raw=>{
 const v=JSON.parse(raw);if(v.documentId!==documentId||typeof v.title!=='string'||typeof v.tags!=='string'||!Object.hasOwn(kinds,v.kind)||!['staff','ops','admin'].includes(v.audience)||!Array.isArray(v.body))throw Error('INVALID_RECOVERY');
 const restored=editorSnapshot(v.body);if(data&&v.kind!==data.kind)throw Error('INVALID_RECOVERY');
 setRecoveryHold(true);setTitle(v.title);setKind(v.kind);setAudience(v.audience);setTags(v.tags);setCover(v.cover);setCategoryIds(normalizeCategoryIds(v.categoryIds));setFieldInputs(v.fieldInputs??{});setQaCategory(v.qa?.category??'');setQaPosition(String(v.qa?.position??0));editor.replaceBlocks(editor.document,restored as typeof editorSchema.PartialBlock[]);
 }}/>

 {state.error&&<EditorRecovery documentId={documentId} sequence={sequence} busy={state.busy||uploading||frozen} copy={copy} onLoad={next=>{if(!frozen)onLoad(next,copy);}}/>}
 {validation&&validation!=='请填写文章标题，才能保存。'&&<p role="alert">{validation}</p>}{frozen&&<p role="alert">{reviewLocked?'正在核对二审提交结果，编辑暂时暂停。请在二审窗口完成核对。':data?.status==='in_review'?'已提交二审，本次版本暂时锁定。已有正式版本继续可读。':'当前内容已停用，不能编辑。请先完成相应流程。'}</p>}{notice&&!notice.startsWith('草稿已保存')&&<p>{notice}</p>}{data&&(data.publishedRevision!==null||data.status!=='draft')&&<p className="editor-published-note">{publicationLabel({revision:0,publishedRevision:data.publishedRevision,status:data.status as 'draft'})}</p>}
 {data&&data.publishedRevision!==null&&<p className="editor-publication-guidance">修改会保存为新草稿，旧正式版继续可读；新稿需要重新二审和发布。</p>}

 </div><div className="editor-workarea"><div className="editor-writing"><div className="editor-document-heading">{kind!=='qa'&&<button className="editor-cover-trigger" type="button" onClick={()=>openSettings('files')}><ImageSquare size={17}/>{cover?'管理封面':'添加封面'}</button>}<span className="editor-draft-label">{{draft:'草稿',in_review:'等待二审',changes_requested:'需要修改',approved:'已经批准',queued:'等待发布',published:'已经发布'}[data?.status??'draft']??data?.status}</span><label className="editor-title-label"><span className="sr-only">文章标题</span><textarea ref={titleElement} aria-label={kind==='qa'?'问题':'文章标题'} placeholder={kind==='qa'?'输入员工会问的问题':'请输入文章标题'} rows={1} maxLength={200} disabled={frozen} value={title} onChange={e=>setTitle(e.target.value)}/></label>{!title.trim()&&<p className="editor-title-hint">{kind==='qa'?'先填写问题，再在下方编写标准答案。':'先给文章起个标题，之后修改会自动保存。'}</p>}<div className="editor-metadata-summary">{kind==='qa'?<label className="qa-editor-category">问答分类<input aria-label="问答分类" maxLength={80} disabled={frozen} value={qaCategory} placeholder="例如：账户问题" onChange={e=>setQaCategory(e.target.value)}/></label>:<button type="button" onClick={()=>openSettings('categories')}>{categoryIds.length?'分类：'+categoryIds.map(id=>categoryOptions.find(c=>c.id===id)?.name??'原有分类').slice(0,2).join('、')+(categoryIds.length>2?` 等 ${categoryIds.length} 项`:''):'添加分类'}</button>}<button type="button" onClick={()=>openSettings('basic')}>谁可以阅读：{{staff:'全体员工',ops:'运营和管理员',admin:'仅管理员'}[audience]}</button><button type="button" aria-label="更多文章设置" onClick={()=>openSettings()}>更多设置</button></div></div>
 {(kind==='article'||kind==='ops')&&<details className="editor-outline-help"><summary>如何生成文章右侧目录？</summary><div><p>在正文新的一行输入 <code>/</code>，选择“一级标题”“二级标题”或“三级标题”。已有文字可通过段落左侧菜单改成标题。</p><p>标题按层级生成右侧目录；只把文字<strong>加粗</strong>，不会生成目录。页面顶部的文章名称也不是正文小标题。</p><p>左侧的主分类、子分类在“添加分类”中设置，与正文标题分开管理。写好后打开“预览草稿”检查层级；正式页面在二审发布后更新。</p></div></details>}
 <EditorContext.Provider value={{documentId,assets,frozen}}><div className="editor-canvas">{kind==='qa'&&<p className="qa-answer-label">标准答案</p>}<BlockNoteView editor={editor} editable={!frozen} theme={theme} slashMenu={false}>
  <SuggestionMenuController triggerCharacter="/" getItems={async query=>{
   const extra=([['hint','提示框'],['tabs','分页标签'],['math','数学公式'],['diagram','流程图']] as const).map(([type,title])=>({title,group:'扩展内容',aliases:[type],onItemClick:()=>add(type)}));
   return [...getDefaultReactSlashMenuItems(editor),...extra].filter(item=>[item.title,...(item.aliases??[])].some(text=>text.toLowerCase().includes(query.toLowerCase())));
  }}/>
 </BlockNoteView></div></EditorContext.Provider>
 </div>{preview&&<section className="editor-preview" aria-label="发布效果预览"><div className="editor-preview-heading"><strong>发布效果预览</strong><button type="button" aria-label="关闭预览" onClick={()=>setPreview(false)}><X size={18}/></button></div><h2>{title||'未命名草稿'}</h2><p>当前草稿 · 尚未发布</p>{(frozen||!validation)&&<FieldValues fields={frozen?data?.customFields:customFields()}/>}{body?<DocumentView document={parseReaderBody(body)} documentId={documentId} admin/>:<p>当前内容有待修正，预览暂不可用。输入仍保留。</p>}</section>}
 </div><dialog ref={settingsDialog} className="editor-settings-drawer" aria-labelledby="editor-settings-title" onClose={()=>{setSettingsOpen(false);settingsTrigger.current?.focus();}}><div className="editor-settings-heading"><h2 id="editor-settings-title">{panelNames[settingsSection]??'文章设置'}</h2><button type="button" aria-label="关闭文章设置" onClick={()=>settingsDialog.current?.close()}><X size={20}/></button></div><div className="editor-settings-content">{settingsSection?<button className="editor-settings-back" type="button" onClick={()=>setSettingsSection('')}><ArrowLeft size={16}/>全部设置</button>:<nav className="editor-settings-menu" aria-label="文章设置项目">{Object.entries(panelNames).map(([key,label])=><button key={key} type="button" onClick={()=>setSettingsSection(key)}><strong>{label}</strong><span>{{basic:'设置资料类型、阅读权限和标签',categories:'选择文章在资料库中的位置',files:'上传文件，选择文章封面',fields:'填写团队设置的补充资料',actions:'备份输入、查看历史或移入回收站'}[key]}</span></button>)}</nav>}<section hidden={settingsSection!=='basic'} data-section="basic"> <fieldset disabled={frozen}><legend>文章资料</legend><div className="editor-metadata"><label>资料类型<select value={kind} disabled={data!==null||state.busy||newQa||newOps} onChange={e=>{const v=e.target.value as ContentKind;setKind(v);if(v==='ops'&&audience==='staff')setAudience('ops');}}>{Object.entries(kinds).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><label>阅读范围<select value={audience} onChange={e=>setAudience(e.target.value as Audience)}>{kind!=='ops'&&<option value="staff">全体员工（客服、运营、管理员）</option>}<option value="ops">运营和管理员</option><option value="admin">仅管理员</option></select></label><label>文章标签<input maxLength={500} value={tags} onChange={e=>setTags(e.target.value)} placeholder="例如：域名转入，客户验证"/></label></div></fieldset>
 {kind==='qa'&&<fieldset disabled={frozen}><legend>问题分类与排序</legend><div className="editor-metadata"><label>问答分类<input maxLength={80} value={qaCategory} onChange={e=>setQaCategory(e.target.value)} placeholder="例如：账户问题"/></label><label>问答排序<input type="number" min="0" max="999999" step="1" value={qaPosition} onChange={e=>setQaPosition(e.target.value)}/></label></div><p className="qa-editor-note">标题填写问题，正文填写答案。分类留空表示未分类；排序数字越小越靠前，相同数字按问题标题排序。问答分类只用于查找，不改变既有阅读权限。分类和排序修改也须二审发布。</p></fieldset>}
</section><section hidden={settingsSection!=='categories'} data-section="categories"> {frozen?<ArticleCategories options={data?.categoryOptions} ids={data?.categoryIds}/>:<CategoryInputs options={categoryOptions} ids={categoryIds} disabled={frozen} onChange={setCategoryIds}/>}
</section><section hidden={settingsSection!=='files'} data-section="files"> <fieldset disabled={frozen||uploading}><legend>私有文件与封面</legend><label className="editor-upload-control"><span>{uploading?'正在上传…':'选择文件上传'}</span><input aria-label="上传文件" type="file" disabled={!data} accept=".png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mp3,.ogg,.pdf,.txt,.csv" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void upload(f).catch(()=>{});}}/></label>{!data&&<p>填写标题并等候草稿保存后，即可上传文件。</p>}<label>选择本篇文件<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">请选择文件</option>{assets.filter(a=>a.status==='ready').map(a=><option key={a.id} value={a.id}>{a.filename}</option>)}</select></label><div className="media-toolbar"><button type="button" disabled={!selected} onClick={()=>{const a=assets.find(a=>a.id===selected);if(a)add(a.mime.startsWith('image/')?'image':a.mime.startsWith('video/')?'video':a.mime.startsWith('audio/')?'audio':'file');}}>插入文件到正文</button></div><label>文章封面<select value={cover?.assetId??''} onChange={e=>setCover(e.target.value?{assetId:e.target.value,alt:'',position:50}:null)}><option value="">不使用封面</option>{assets.filter(a=>a.status==='ready'&&a.mime.startsWith('image/')).map(a=><option key={a.id} value={a.id}>{a.filename}</option>)}</select></label>{cover&&<><label>封面替代文字<input value={cover.alt} maxLength={200} onChange={e=>setCover({...cover,alt:e.target.value})}/></label><label>封面位置<input type="range" min={0} max={100} value={cover.position} onChange={e=>setCover({...cover,position:Number(e.target.value)})}/></label></>}</fieldset>
</section><section hidden={settingsSection!=='fields'} data-section="fields"> {frozen?<FieldValues fields={data?.customFields}/>:<FieldInputs definitions={definitions} previous={initial?.customFields??[]} values={fieldInputs} onChange={(id,value)=>setFieldInputs(old=>({...old,[id]:value}))} disabled={frozen}/>}
</section><section hidden={settingsSection!=='actions'} data-section="actions"><button type="button" disabled={frozen||state.busy||!state.dirty||Boolean(validation)} onClick={()=>void saver.save(true)}>{state.error?'重试保存':'立即保存'}</button><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(copy);setNotice('当前输入已复制。');}catch{setNotice('无法复制，请保留此页面并手动复制输入。');}}}>复制当前输入</button><button type="button" disabled={state.busy} onClick={async()=>{if(!mustWarn||await confirmAction('刷新会清除页面内未保存输入及恢复备份，确定继续？','重新载入文章？')){leaving.current=true;window.location.reload();}}}>重新载入</button> {data&&!reviewLocked&&<p className="editor-review-link"><a href={`/admin/review?article=${encodeURIComponent(documentId)}`}>查看二审详情与退回原因</a><a href={`/admin/availability?article=${encodeURIComponent(documentId)}`}>归档与下线</a><a href={`/admin/history?article=${encodeURIComponent(documentId)}`}>历史记录与版本</a>{data.status==='changes_requested'&&' · 请先按退回原因修改并保存，再重新提交二审。'}</p>} {data&&<DocumentTrashAction id={documentId} title={title} sequence={sequence??data.sequence} disabled={dirty||state.busy||uploading||reviewLocked||data.lifecycle!=='active'} onBusy={setDeleting} onDeleted={sequence=>{setData({...data,sequence,lifecycle:'trashed',status:'draft',publishedRevision:null});}}/>}</section></div></dialog>
 </section>;
}
function providedLabel(data:EditorData|null){return data?'编辑文章':'新建文章';}
