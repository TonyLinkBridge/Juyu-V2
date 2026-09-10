'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {NavigationWriteRejected,readNavigationSettings,saveNavigationSettings} from '../../navigation-settings/client';
import {navigationPages,parseNavigationWrite,type NavigationConfig,type NavigationEntry,type NavigationWrite,type NavigationPage} from '../../navigation-settings/model';
import type {CategoryDefinition} from '../../categories/model';

type Notice={kind:'error'|'success';text:string};
type Backup={write:NavigationWrite;pending:NavigationWrite|null;createdAt:string};
const pages:Record<NavigationPage,string>={home:'帮助中心',ops:'OPS',reference:'参考资料',qa:'常见问题',favorites:'收藏',recent:'最近浏览',forms:'表单'};
const roles={support:'客服（Support）',ops:'运营（Ops）',admin:'管理员（Admin）'};
const roleOrder=['support','ops','admin'] as const;
function cloneWrite(write:NavigationWrite):NavigationWrite{return {expectedVersion:write.expectedVersion,entries:write.entries.map(entry=>({...entry,roles:[...entry.roles],target:{...entry.target}}))};}
function fromConfig(config:NavigationConfig):NavigationWrite{return cloneWrite({expectedVersion:config.version,entries:config.entries});}
function targetLabel(entry:NavigationEntry,categories:CategoryDefinition[]){return entry.target.type==='page'?pages[entry.target.page]:categories.find(category=>entry.target.type==='category'&&category.id===entry.target.categoryId)?.name??'当前分类不可用';}
function categoryPath(category:CategoryDefinition,categories:CategoryDefinition[]){const names=[category.name],seen=new Set([category.id]);let parent=category.parentId;while(parent&&!seen.has(parent)){seen.add(parent);const current=categories.find(candidate=>candidate.id===parent);if(!current)break;names.unshift(current.name);parent=current.parentId;}return names.join(' / ');}
const rejectionText:Record<string,string>={NAVIGATION_CONFLICT:'导航已有新版本。当前输入已保留；请保留备份并载入最新设置，再确认修改。',FORBIDDEN:'当前账号没有管理导航的权限。输入和备份仍保留在本页。',INVALID_INPUT:'导航设置未通过校验。请检查名称、角色和入口目标。'};

export function NavigationSettings({initial,categories:initialCategories=[],state='ready'}:{initial?:NavigationConfig;categories?:CategoryDefinition[];state?:'ready'|'unavailable'|'denied'}){
 const [config,setConfig]=useState<NavigationConfig|null>(initial??null);
 const [categories,setCategories]=useState(initialCategories);
 const [availability,setAvailability]=useState(state==='ready'&&!initial?'unavailable':state);
 const [draft,setDraft]=useState<NavigationWrite|null>(initial?fromConfig(initial):null);
 const [selectedId,setSelectedId]=useState<string|null>(initial?.entries[0]?.id??null);
 const [pending,setPending]=useState<NavigationWrite|null>(null);
 const [backups,setBackups]=useState<Backup[]>([]);
 const [busy,setBusy]=useState(false);
 const [conflict,setConflict]=useState(false);
 const [notice,setNotice]=useState<Notice|null>(null);
 const lock=useRef(false),navigationConfirmed=useRef(false);
 const frozen=busy||pending!==null||availability!=='ready';
 const locked=busy||pending!==null;
 const dirty=!!(draft&&config&&JSON.stringify(draft.entries)!==JSON.stringify(config.entries));
 const hasRetainedInput=dirty||backups.length>0;
 const selected=draft?.entries.find(entry=>entry.id===selectedId);
 const selectedIndex=draft?.entries.findIndex(entry=>entry.id===selectedId)??-1;
 const selectedCategory=selected?.target.type==='category'?categories.find(category=>selected.target.type==='category'&&category.id===selected.target.categoryId):undefined;

 useEffect(()=>{
  navigationConfirmed.current=false;if(!hasRetainedInput&&!locked)return;
  function beforeUnload(event:BeforeUnloadEvent){if(navigationConfirmed.current)return;event.preventDefault();event.returnValue='';}
  function navigate(event:MouseEvent){
   const anchor=event.target instanceof Element?event.target.closest('a[href]'):null;
   if(!anchor||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||anchor.getAttribute('target')==='_blank'||anchor.hasAttribute('download'))return;
   const target=new URL(anchor.getAttribute('href')!,window.location.href);
   if(target.origin===window.location.origin&&target.pathname===window.location.pathname&&target.search===window.location.search&&target.hash)return;
   event.preventDefault();event.stopPropagation();
   if(locked||!window.confirm('本页有未保存的导航修改或保留的配置备份，离开后会丢失。确定离开吗？'))return;
   navigationConfirmed.current=true;window.location.assign(target.href);
  }
  window.addEventListener('beforeunload',beforeUnload);document.addEventListener('click',navigate,true);
  return()=>{window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('click',navigate,true);};
 },[hasRetainedInput,locked]);

 function updateEntries(entries:NavigationEntry[]){if(!lock.current&&!frozen)setDraft(current=>current?{...current,entries}:null);}
 function patchEntry(value:Partial<NavigationEntry>){if(draft&&selected)updateEntries(draft.entries.map(entry=>entry.id===selected.id?{...entry,...value}:entry));}
 function addEntry(){
  if(lock.current||frozen||!draft||draft.entries.length>=40)return;
  const entry:NavigationEntry={id:crypto.randomUUID(),label:'新入口',enabled:false,roles:['support','ops','admin'],target:{type:'page',page:'home'}};
  updateEntries([...draft.entries,entry]);setSelectedId(entry.id);setNotice(null);
 }
 function removeEntry(){if(!draft||!selected||lock.current||frozen)return;const entries=draft.entries.filter(entry=>entry.id!==selected.id);updateEntries(entries);setSelectedId(entries[Math.min(selectedIndex,entries.length-1)]?.id??null);}
 function moveEntry(direction:-1|1){if(!draft||selectedIndex<0)return;const next=selectedIndex+direction;if(next<0||next>=draft.entries.length)return;const entries=[...draft.entries];[entries[selectedIndex],entries[next]]=[entries[next],entries[selectedIndex]];updateEntries(entries);}
 function toggleRole(role:NavigationEntry['roles'][number],checked:boolean){if(!selected)return;const next=roleOrder.filter(value=>value===role?checked:selected.roles.includes(value));if(next.length>0)patchEntry({roles:next});}
 function remember(write:NavigationWrite,pendingWrite:NavigationWrite|null){setBackups(current=>[...current,{write:cloneWrite(write),pending:pendingWrite?cloneWrite(pendingWrite):null,createdAt:new Date().toLocaleString('zh-CN')}]);}
 function restore(backup:Backup){
  if(lock.current||frozen||!config||!draft)return;
  if(dirty)remember(draft,null);
  const restored={...cloneWrite(backup.write),expectedVersion:config.version};setDraft(restored);setSelectedId(restored.entries[0]?.id??null);setConflict(false);
  setNotice({kind:'success',text:'备份已放回编辑区，尚未保存。请核对当前入口和角色，再保存。'});
 }
 async function submit(event?:FormEvent){
  event?.preventDefault();if(lock.current||!draft||availability!=='ready'||(conflict&&!pending))return;
  let write=pending;const wasUncertain=pending!==null;
  if(!write){try{write=parseNavigationWrite(draft);}catch{setNotice({kind:'error',text:'每个入口需填写 1–80 字的名称、至少一个角色和有效目标；最多 40 个入口。'});return;}}
  lock.current=true;setBusy(true);setPending(write);setNotice(null);
  try{
   const result=await saveNavigationSettings(write);setConfig(result);setDraft(fromConfig(result));setPending(null);setConflict(false);
   setNotice({kind:'success',text:result.entries.some(entry=>entry.enabled)?'导航设置已保存。入口仍按目标的当前访问权限显示。':'导航设置已保存，全部快捷入口已隐藏。固定首页与退出入口仍保留。'});
  }catch(error){
   if(error instanceof NavigationWriteRejected&&!wasUncertain){
    setPending(null);setConflict(error.message==='NAVIGATION_CONFLICT');if(error.message==='FORBIDDEN')setAvailability('denied');
    setNotice({kind:'error',text:rejectionText[error.message]??'保存被拒绝，当前输入已保留。'});
   }else{
    setConflict(error instanceof NavigationWriteRejected&&error.message==='NAVIGATION_CONFLICT');
    setNotice({kind:'error',text:error instanceof NavigationWriteRejected?'重试未能确认原提交，仍无法确认此前是否保存成功。原配置继续保留，可重试或保留备份并载入最新设置。':'暂时无法确认是否保存成功。原配置已锁定，请重试原提交，或保留备份并载入最新设置。'});
   }
  }finally{lock.current=false;setBusy(false);}
 }
 async function reload(){
  if(lock.current)return;
  if((dirty||pending)&&!window.confirm('将保留当前输入备份，再载入服务器最新导航和分类设置。此操作不会撤销可能已保存的配置。确定继续吗？'))return;
  const retained=draft?cloneWrite(draft):null;const uncertain=pending?cloneWrite(pending):null;const keep=dirty||pending!==null||conflict;
  lock.current=true;setBusy(true);setNotice(null);
  try{
   const latest=await readNavigationSettings();if(retained&&keep)remember(retained,uncertain);
   setConfig(latest.config);setDraft(fromConfig(latest.config));setCategories(latest.categories);setAvailability('ready');setPending(null);setConflict(false);setSelectedId(latest.config.entries[0]?.id??null);
   setNotice({kind:'success',text:uncertain?'已载入服务器当前设置，原提交和输入备份已保留。此前是否曾保存仍无法确认。':'已载入最新导航和分类设置；未保存输入的备份会保留在本页。'});
  }catch(error){if(!pending&&error instanceof Error&&error.message==='FORBIDDEN')setAvailability('denied');setNotice({kind:'error',text:'暂时无法完整载入导航和分类。当前输入、原提交和已有备份均保留，请稍后重试。'});}
  finally{lock.current=false;setBusy(false);}
 }

 return <section className="navigation-settings" aria-label="导航设置" aria-busy={busy}>
  <header className="navigation-settings-heading"><div><h1>导航设置</h1><p>配置员工快捷入口的名称、顺序和角色可见性。</p></div><a className="secondary-link" role="link" href={locked?undefined:'/admin/settings/history'} aria-disabled={locked||undefined} tabIndex={locked?-1:undefined}>设置变更记录</a></header>
  <p className="navigation-settings-note">隐藏菜单不会收回内容访问权限。员工能否访问目标页面，仍由现有角色、分类和正式内容权限决定。修改快捷入口不会改动文章目录。</p>
  <p className="navigation-settings-note">品牌首页、退出和管理员后台入口是固定系统入口，不在这里移除。移除快捷入口不会删除分类、文章或其他内容。</p>
  {availability!=='ready'&&<div className="navigation-settings-unavailable" role="status"><h2>{availability==='denied'?'没有管理权限':'导航设置暂时不可用'}</h2><p>{availability==='denied'?'只有管理员可以查看和修改原始导航设置。':'未能完整载入导航和分类设置，当前无法确认配置。'}</p>{availability==='unavailable'&&<button type="button" disabled={busy} onClick={()=>void reload()}>重新载入</button>}</div>}
  {availability==='ready'&&config&&draft&&<>
   <p className="navigation-settings-version">{config.version===0?'正在使用系统默认入口，尚未保存自定义导航。':`当前配置版本 ${config.version}`}{dirty?' · 有未保存修改':''}</p>
   <form onSubmit={submit}><div className="navigation-settings-layout">
    <section className="navigation-settings-list" aria-labelledby="navigation-list-title"><div className="navigation-settings-toolbar"><h2 id="navigation-list-title">快捷入口 <span>{draft.entries.length} / 40</span></h2><button type="button" disabled={frozen||draft.entries.length>=40} onClick={addEntry}>添加入口</button></div>
     {draft.entries.length===0?<p className="navigation-settings-empty">没有快捷入口。保存空配置后，员工只保留固定系统入口。</p>:<ol>{draft.entries.map((entry,index)=><li key={entry.id}><button type="button" className="navigation-settings-item" disabled={frozen} aria-pressed={entry.id===selectedId} onClick={()=>setSelectedId(entry.id)}><strong>{index+1}. {entry.label||'未命名入口'}</strong><span>{targetLabel(entry,categories)} · {entry.enabled?'已启用':'已停用'}</span><small>{entry.roles.map(role=>roles[role]).join('、')}</small></button></li>)}</ol>}
     {draft.entries.length>0&&!draft.entries.some(entry=>entry.enabled)&&<p className="navigation-settings-note">全部快捷入口已停用。固定系统入口仍保留。</p>}
     {draft.entries.length>=40&&<p className="navigation-settings-note">已达到 40 个入口上限，包含停用入口。</p>}
    </section>
    <section className="navigation-settings-editor" aria-labelledby="navigation-editor-title"><h2 id="navigation-editor-title">入口详情</h2>
     {!selected?<p className="navigation-settings-empty">添加或选择一个快捷入口。</p>:<fieldset disabled={frozen}><legend className="navigation-settings-sr">快捷入口配置</legend>
      <label htmlFor="navigation-label">入口名称<input id="navigation-label" aria-label="入口名称" value={selected.label} required aria-describedby="navigation-label-help" onChange={event=>patchEntry({label:event.target.value})}/><small id="navigation-label-help">1–80 字。仅改变菜单显示名称。</small></label>
      <label htmlFor="navigation-target-type">目标类型<select id="navigation-target-type" aria-label="目标类型" value={selected.target.type} onChange={event=>{if(event.target.value==='page')patchEntry({target:{type:'page',page:'home'}});else if(categories[0])patchEntry({target:{type:'category',categoryId:categories[0].id}});}}><option value="page">现有页面</option><option value="category" disabled={categories.length===0}>分类</option></select></label>
      {selected.target.type==='page'?<label htmlFor="navigation-page">目标页面<select id="navigation-page" aria-label="目标页面" value={selected.target.page} onChange={event=>patchEntry({target:{type:'page',page:event.target.value as NavigationPage}})}>{navigationPages.map(page=><option value={page} key={page}>{pages[page]}</option>)}</select></label>:<label htmlFor="navigation-category">目标分类<select id="navigation-category" aria-label="目标分类" value={selected.target.categoryId} onChange={event=>patchEntry({target:{type:'category',categoryId:event.target.value}})}>{!selectedCategory&&<option value={selected.target.categoryId}>当前分类不可用</option>}{categories.map(category=><option value={category.id} key={category.id}>{categoryPath(category,categories)}{category.enabled?'':'（已停用）'}</option>)}</select></label>}
      {selected.target.type==='page'&&selected.target.page==='ops'&&<p className="navigation-settings-note">OPS 仅对运营和管理员开放。勾选客服角色不会授予 OPS 访问权限。</p>}
      {selected.target.type==='category'&&<p className="navigation-settings-note">分类入口仍受父分类、启停状态和当前正式内容权限限制。{selectedCategory&&!selectedCategory.enabled?'此分类目前已停用。':''}</p>}
      <fieldset className="navigation-settings-role-group"><legend>哪些角色可以看到入口</legend>{roleOrder.map(role=><label className="navigation-settings-check" key={role}><input type="checkbox" aria-label={roles[role]} checked={selected.roles.includes(role)} disabled={frozen||(selected.roles.length===1&&selected.roles.includes(role))} onChange={event=>toggleRole(role,event.target.checked)}/>{roles[role]}</label>)}<small>至少保留一个角色。如需全部隐藏，请停用入口。</small></fieldset>
      <label className="navigation-settings-check"><input type="checkbox" checked={selected.enabled} onChange={event=>patchEntry({enabled:event.target.checked})}/>启用入口</label>
      <div className="navigation-settings-entry-actions"><button type="button" disabled={frozen||selectedIndex===0} onClick={()=>moveEntry(-1)}>上移</button><button type="button" disabled={frozen||selectedIndex===draft.entries.length-1} onClick={()=>moveEntry(1)}>下移</button><button type="button" onClick={removeEntry}>移除此入口</button></div>
      <p className="navigation-settings-note">只移除快捷入口，目标内容会保留。</p>
     </fieldset>}
    </section>
   </div><div className="navigation-settings-actions">{pending?<button type="button" className="navigation-settings-primary" disabled={busy} onClick={()=>void submit()}>{busy?'正在确认保存…':'重试原提交'}</button>:<button type="submit" className="navigation-settings-primary" disabled={busy||conflict}>{busy?'正在保存…':'保存导航'}</button>}<button type="button" disabled={busy} onClick={()=>void reload()}>{pending||conflict?'保留备份并载入最新设置':'载入最新导航和分类'}</button></div></form>
  </>}
  {availability!=='ready'&&draft&&<details open className="navigation-settings-backup"><summary>当前输入仍保留</summary><textarea readOnly aria-label="当前导航输入" value={JSON.stringify({draft,pending},null,2)}/></details>}
  {notice&&<p className={`navigation-settings-message navigation-settings-message-${notice.kind}`} role={notice.kind==='error'?'alert':'status'}>{notice.text}</p>}
  {backups.length>0&&<section className="navigation-settings-backups" aria-label="保留的配置备份"><h2>保留的配置备份</h2><p className="navigation-settings-note">每次载入前的未保存输入都会单独保留。备份仅在本页，离开前请下载需要的备份。</p>{backups.map((backup,index)=><details className="navigation-settings-backup" open key={index}><summary>配置备份 {index+1} · {backup.createdAt}</summary><p>{backup.write.entries.map(entry=>entry.label||'未命名入口').join('、')||'空配置'}</p><textarea readOnly aria-label={`配置备份 ${index+1}`} value={JSON.stringify(backup,null,2)}/><div className="navigation-settings-entry-actions"><button type="button" disabled={frozen||!config} onClick={()=>restore(backup)}>将备份 {index+1} 放回编辑区</button><a className="secondary-link" download={`navigation-backup-${index+1}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backup,null,2))}`}>下载备份 {index+1}</a></div></details>)}</section>}
 </section>;
}
