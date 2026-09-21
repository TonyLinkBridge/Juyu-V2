'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {reusableFragmentInput,type ReusableFragment} from '../../editor/reusable-fragment';
import type {EditorBlock} from '../../editor/document';

export function ReusableFragmentDialog({selection,usages,onInsert,onRefresh,onClose,locale='zh-CN'}:{selection:EditorBlock[];usages:{familyId:string;version:number;title:string}[];onInsert:(fragment:ReusableFragment)=>Promise<void>;onRefresh:(fragment:ReusableFragment)=>Promise<boolean>;onClose:()=>void;locale?:'zh-CN'|'en'}){
 const t=useCallback((zh:string,en:string)=>locale==='en'?en:zh,[locale]);
 const dialog=useRef<HTMLDialogElement>(null);
 const [items,setItems]=useState<ReusableFragment[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [title,setTitle]=useState('');
 const [selected,setSelected]=useState('');
 const [message,setMessage]=useState('');
 useEffect(()=>{const node=dialog.current;if(!node)return;node.showModal();return()=>node.close();},[]);
 useEffect(()=>{const controller=new AbortController();
  void fetch('/api/admin/fragments',{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('READ_FAILED');
   const data:unknown=await response.json();
   if(!Array.isArray(data))throw new Error('READ_FAILED');
   setItems(data as ReusableFragment[]);
  }).catch(error=>{if(!controller.signal.aborted)setMessage(error instanceof Error&&error.name==='AbortError'?'':t('片段库暂时无法读取，请稍后重试。','Could not load reusable snippets. Please try again later.'));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[t]);
 async function create(){
  setMessage('');setBusy(true);
  try{
   const input=reusableFragmentInput({id:crypto.randomUUID(),title,blocks:selection});
   const response=await fetch('/api/admin/fragments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   const result:unknown=await response.json();
   if(!response.ok)throw new Error(response.status===404?'FRAGMENT_ASSET_UNAVAILABLE':response.status===400?'INVALID_INPUT':'SAVE_FAILED');
   const saved=result as ReusableFragment;
   if(saved.id!==input.id||saved.title!==input.title||!Array.isArray(saved.blocks))throw new Error('SAVE_FAILED');
   setItems(current=>[saved,...current].slice(0,50));setSelected(saved.familyId);setTitle('');setMessage(t('已存入片段库。插入文章后，仍需保存并完成二审发布。','Snippet saved. After inserting it, save and review each article before publishing.'));
  }catch(error){setMessage(error instanceof Error&&error.message==='FRAGMENT_ASSET_UNAVAILABLE'?t('所选图片或附件已不可用；请先检查原文章的文件。','A selected image or attachment is unavailable. Check the source article’s files.'):error instanceof Error&&error.message==='INVALID_INPUT'?t('请选择 1–20 个有效内容块，并填写片段名称。','Select 1–20 valid blocks and name the snippet.'):t('保存未确认成功；请重新读取片段库后核对，避免重复创建。','Could not confirm the save. Reload the snippet library before trying again to avoid duplicates.'));}
  finally{setBusy(false);}
 }
 async function update(){const item=items.find(fragment=>fragment.familyId===selected);if(!item)return;
  setBusy(true);setMessage('');
  try{const value=reusableFragmentInput({id:crypto.randomUUID(),title:item.title,blocks:selection});const response=await fetch(`/api/admin/fragments/${encodeURIComponent(item.familyId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,expectedVersion:item.version})});const result:unknown=await response.json();if(!response.ok)throw new Error(response.status===409?'CONFLICT':response.status===400?'INVALID_INPUT':'SAVE_FAILED');const saved=result as ReusableFragment;if(saved.familyId!==item.familyId||saved.version!==item.version+1)throw new Error('SAVE_FAILED');setItems(current=>current.map(old=>old.familyId===saved.familyId?saved:old));setMessage(locale==='en'?`Snippet version ${saved.version} saved. Existing articles still use their previous versions; update and review them separately.`:`片段第 ${saved.version} 版已保存；旧文章仍使用原版本，需逐篇更新并二审。`);}
  catch(error){setMessage(error instanceof Error&&error.message==='CONFLICT'?t('另一位管理员已更新这个片段。请关闭后重新打开片段库，再决定是否保存。','Another admin updated this snippet. Close and reopen the library before deciding whether to save.'):error instanceof Error&&error.message==='INVALID_INPUT'?t('所选内容不符合片段要求，请检查内容块。','The selected blocks do not meet the snippet requirements. Check your selection.'):t('新版本未确认保存成功，请重新读取后核对。','Could not confirm the new version was saved. Reload and check before retrying.'));}
  finally{setBusy(false);}
 }
 async function insert(){const item=items.find(fragment=>fragment.familyId===selected);if(!item)return;
  setBusy(true);setMessage('');try{await onInsert(item);onClose();}
  catch{setMessage(t('片段未插入：请先保存本篇草稿，并确认原图片或附件仍可读取。当前文章没有被改动。','Could not insert the snippet. Save this draft and check the source images or attachments. This article was not changed.'));}finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="reusable-fragment-dialog" aria-label={t("可复用内容片段","Reusable snippets")} onClose={onClose}>
  <header><div><h2>{t("可复用内容片段","Reusable snippets")}</h2><p>{t("保存选中的内容，之后可插入其他文章；每篇文章仍须单独审核发布。","Save selected content to use in other articles. Each article still needs its own review and publication.")}</p></div><button type="button" aria-label={t("关闭片段库","Close snippet library")} onClick={()=>dialog.current?.close()}>×</button></header>
  <section><h3>{t("保存当前选择","Save selection")}</h3><p>{locale==='en'?`${selection.length} blocks selected. Images and attachments are copied as private files when inserted into another article.`:`当前选择 ${selection.length} 个内容块。图片和附件在插入其他文章时会复制为该文章自己的私有文件。`}</p><label>{t("片段名称","Snippet name")}<input value={title} maxLength={120} onChange={event=>setTitle(event.target.value)} placeholder={t("例如：账户验证说明","For example: Account verification")}/></label><button type="button" disabled={busy||!title.trim()} onClick={()=>void create()}>{t("保存为片段","Save snippet")}</button></section>
  <section><h3>{t("插入或更新片段","Insert or update a snippet")}</h3>{loading?<p>{t("正在读取片段…","Loading snippets…")}</p>:items.length?<><label>{t("选择片段","Choose a snippet")}<select value={selected} onChange={event=>setSelected(event.target.value)}><option value="">{t("请选择","Select one")}</option>{items.map(item=><option key={item.id} value={item.familyId}>{item.title} · {locale==='en'?`Version ${item.version}`:`第 ${item.version} 版`}</option>)}</select></label><div className="reusable-fragment-actions"><button type="button" disabled={!selected||busy} onClick={()=>void insert()}>{busy?t('正在处理…','Working…'):t('插入到文章','Insert into article')}</button><button type="button" disabled={!selected||busy} onClick={()=>void update()}>{t("用当前选择建立新版本","Create a new version from selection")}</button>{items.some(item=>item.familyId===selected&&usages.some(usage=>usage.familyId===selected&&usage.version<item.version))&&<button type="button" disabled={busy} onClick={()=>{const item=items.find(fragment=>fragment.familyId===selected);if(item){setBusy(true);void onRefresh(item).then(accepted=>{if(accepted)onClose();}).catch(()=>setMessage(t('采用新版未成功；请确认原图片和附件可读取，并检查本篇草稿。','Could not use the latest version. Check the source files and this draft.'))).finally(()=>setBusy(false));}}}>{t("在本篇采用最新版","Use latest version in this article")}</button>}</div>{selected&&usages.some(usage=>usage.familyId===selected)&&<p>{locale==='en'?`This article uses version ${Math.min(...usages.filter(usage=>usage.familyId===selected).map(usage=>usage.version))}. Using the latest version replaces manual changes inside the snippet and creates a draft that needs review again.`:`本篇目前使用第 ${Math.min(...usages.filter(usage=>usage.familyId===selected).map(usage=>usage.version))} 版。采用新版会替换片段块里的手动修改，并产生需要重新二审的草稿。`}</p>}</>:<p>{t("尚无可用片段。","No snippets available yet.")}</p>}</section>
  {message&&<p role="status">{message}</p>}
 </dialog>;
}
