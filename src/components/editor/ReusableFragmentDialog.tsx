'use client';
import {useEffect,useRef,useState} from 'react';
import {reusableFragmentInput,type ReusableFragment} from '../../editor/reusable-fragment';
import type {EditorBlock} from '../../editor/document';

export function ReusableFragmentDialog({selection,usages,onInsert,onRefresh,onClose}:{selection:EditorBlock[];usages:{familyId:string;version:number;title:string}[];onInsert:(fragment:ReusableFragment)=>Promise<void>;onRefresh:(fragment:ReusableFragment)=>Promise<boolean>;onClose:()=>void}){
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
  }).catch(error=>{if(!controller.signal.aborted)setMessage(error instanceof Error&&error.name==='AbortError'?'':'片段库暂时无法读取，请稍后重试。');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[]);
 async function create(){
  setMessage('');setBusy(true);
  try{
   const input=reusableFragmentInput({id:crypto.randomUUID(),title,blocks:selection});
   const response=await fetch('/api/admin/fragments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   const result:unknown=await response.json();
   if(!response.ok)throw new Error(response.status===404?'FRAGMENT_ASSET_UNAVAILABLE':response.status===400?'INVALID_INPUT':'SAVE_FAILED');
   const saved=result as ReusableFragment;
   if(saved.id!==input.id||saved.title!==input.title||!Array.isArray(saved.blocks))throw new Error('SAVE_FAILED');
   setItems(current=>[saved,...current].slice(0,50));setSelected(saved.familyId);setTitle('');setMessage('已存入片段库。插入文章后，仍需保存并完成二审发布。');
  }catch(error){setMessage(error instanceof Error&&error.message==='FRAGMENT_ASSET_UNAVAILABLE'?'所选图片或附件已不可用；请先检查原文章的文件。':error instanceof Error&&error.message==='INVALID_INPUT'?'请选择 1–20 个有效内容块，并填写片段名称。':'保存未确认成功；请重新读取片段库后核对，避免重复创建。');}
  finally{setBusy(false);}
 }
 async function update(){const item=items.find(fragment=>fragment.familyId===selected);if(!item)return;
  setBusy(true);setMessage('');
  try{const value=reusableFragmentInput({id:crypto.randomUUID(),title:item.title,blocks:selection});const response=await fetch(`/api/admin/fragments/${encodeURIComponent(item.familyId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,expectedVersion:item.version})});const result:unknown=await response.json();if(!response.ok)throw new Error(response.status===409?'CONFLICT':response.status===400?'INVALID_INPUT':'SAVE_FAILED');const saved=result as ReusableFragment;if(saved.familyId!==item.familyId||saved.version!==item.version+1)throw new Error('SAVE_FAILED');setItems(current=>current.map(old=>old.familyId===saved.familyId?saved:old));setMessage(`片段第 ${saved.version} 版已保存；旧文章仍使用原版本，需逐篇更新并二审。`);}
  catch(error){setMessage(error instanceof Error&&error.message==='CONFLICT'?'另一位管理员已更新这个片段。请关闭后重新打开片段库，再决定是否保存。':error instanceof Error&&error.message==='INVALID_INPUT'?'所选内容不符合片段要求，请检查内容块。':'新版本未确认保存成功，请重新读取后核对。');}
  finally{setBusy(false);}
 }
 async function insert(){const item=items.find(fragment=>fragment.familyId===selected);if(!item)return;
  setBusy(true);setMessage('');try{await onInsert(item);onClose();}
  catch{setMessage('片段未插入：请先保存本篇草稿，并确认原图片或附件仍可读取。当前文章没有被改动。');}finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="reusable-fragment-dialog" aria-label="可复用内容片段" onClose={onClose}>
  <header><div><h2>可复用内容片段</h2><p>保存选中的内容，之后可插入其他文章；每篇文章仍须单独审核发布。</p></div><button type="button" aria-label="关闭片段库" onClick={()=>dialog.current?.close()}>×</button></header>
  <section><h3>保存当前选择</h3><p>当前选择 {selection.length} 个内容块。图片和附件在插入其他文章时会复制为该文章自己的私有文件。</p><label>片段名称<input value={title} maxLength={120} onChange={event=>setTitle(event.target.value)} placeholder="例如：账户验证说明"/></label><button type="button" disabled={busy||!title.trim()} onClick={()=>void create()}>保存为片段</button></section>
  <section><h3>插入或更新片段</h3>{loading?<p>正在读取片段…</p>:items.length?<><label>选择片段<select value={selected} onChange={event=>setSelected(event.target.value)}><option value="">请选择</option>{items.map(item=><option key={item.id} value={item.familyId}>{item.title} · 第 {item.version} 版</option>)}</select></label><div className="reusable-fragment-actions"><button type="button" disabled={!selected||busy} onClick={()=>void insert()}>{busy?'正在处理…':'插入到文章'}</button><button type="button" disabled={!selected||busy} onClick={()=>void update()}>用当前选择建立新版本</button>{items.some(item=>item.familyId===selected&&usages.some(usage=>usage.familyId===selected&&usage.version<item.version))&&<button type="button" disabled={busy} onClick={()=>{const item=items.find(fragment=>fragment.familyId===selected);if(item){setBusy(true);void onRefresh(item).then(accepted=>{if(accepted)onClose();}).catch(()=>setMessage('采用新版未成功；请确认原图片和附件可读取，并检查本篇草稿。')).finally(()=>setBusy(false));}}}>在本篇采用最新版</button>}</div>{selected&&usages.some(usage=>usage.familyId===selected)&&<p>本篇目前使用第 {Math.min(...usages.filter(usage=>usage.familyId===selected).map(usage=>usage.version))} 版。采用新版会替换片段块里的手动修改，并产生需要重新二审的草稿。</p>}</>:<p>尚无可用片段。</p>}</section>
  {message&&<p role="status">{message}</p>}
 </dialog>;
}
