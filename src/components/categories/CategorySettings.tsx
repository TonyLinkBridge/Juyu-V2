'use client';
import {confirmAction} from '../feedback/feedback';

import {useEffect, useRef, useState, type ReactNode, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {CategoryWriteRejected, readCategories, saveCategory} from '../../categories/client';
import {parseCategoryWrite, type CategoryDefinition, type CategoryWrite} from '../../categories/model';
import {readerIconLabels,type ReaderIconKey} from '../../reader/icon-keys';
import {ReaderIcon} from '../../reader/icons';

type Draft = CategoryWrite & {id:string};
type Pending = {id:string; write:CategoryWrite};
type Notice = {kind:'error'|'success'; text:string};
const audiences = {staff:'全体员工',ops:'运营和管理员',admin:'仅管理员'};
const levels = {staff:0,ops:1,admin:2};
function fromDefinition(category:CategoryDefinition):Draft {
  return {id:category.id,expectedVersion:category.version,name:category.name,englishName:category.englishName??'',parentId:category.parentId,position:category.position,audience:category.audience,enabled:category.enabled,iconKey:category.iconKey??null};
}
function descendants(categories:CategoryDefinition[],id:string):Set<string> {
  const ids = new Set([id]);
  for(let changed=true;changed;) {
    changed=false;
    for(const category of categories)if(category.parentId && ids.has(category.parentId) && !ids.has(category.id)){ids.add(category.id);changed=true;}
  }
  return ids;
}
function hierarchy(categories:CategoryDefinition[]) {
  const rows:{category:CategoryDefinition;depth:number}[]=[];
  const seen=new Set<string>();
  function visit(category:CategoryDefinition,depth:number) {
    if(seen.has(category.id))return;
    seen.add(category.id);rows.push({category,depth});
    for(const child of sorted)if(child.parentId===category.id)visit(child,depth+1);
  }
  const sorted=[...categories].sort((a,b)=>a.position-b.position || a.id.localeCompare(b.id));
  for(const category of sorted)if(category.parentId===null)visit(category,0);
  for(const category of sorted)visit(category,0);
  return rows;
}
function effectivePolicy(categories:CategoryDefinition[],category:Draft|CategoryDefinition) {
  let audience=category.audience;let enabled=category.enabled;let current:Draft|CategoryDefinition|undefined=category;
  const seen=new Set<string>();
  while(current) {
    if(seen.has(current.id))return '层级异常，无法确认访问范围';
    seen.add(current.id);enabled=enabled && current.enabled;
    if(levels[current.audience]>levels[audience])audience=current.audience;
    if(!current.parentId)break;
    current=categories.find(candidate=>candidate.id===current?.parentId);
    if(!current)return '父分类不可用，无法确认访问范围';
  }
  return enabled ? audiences[audience] : '已停用：关联内容不向员工开放';
}
const rejectionText:Record<string,string> = {
  CATEGORY_CONFLICT:'这项分类已有新版本。你的输入已保留；请载入最新设置，再确认修改。',
  CATEGORY_LIMIT:'分类总数已达到 100 项，停用分类也计入总数。',
  CATEGORY_CYCLE:'不能把分类移动到自己或自己的子分类下。请重新选择父分类。',
  CATEGORY_DEPTH:'分类最多支持 10 层。请调整父分类，避免子分类超过层级上限。',
  FORBIDDEN:'当前账号没有管理分类的权限。你的输入已保留。',
  INVALID_INPUT:'分类设置未通过校验。请检查名称、父分类、排序和访问范围。',
};

export function CategorySettings({initial=[],state='ready'}:{initial?:CategoryDefinition[];state?:'ready'|'unavailable'|'denied'}) {
    const router=useRouter();
  const [categories,setCategories]=useState(initial);
  const [availability,setAvailability]=useState(state);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [busy,setBusy]=useState(false);
  const [pending,setPending]=useState<Pending|null>(null);
  const [conflict,setConflict]=useState(false);
  const [notice,setNotice]=useState<Notice|null>(null);
  const lock=useRef(false);
  const navigationConfirmed=useRef(false);
  const frozen=busy || pending!==null || availability!=='ready';
  const navigationLocked=busy || pending!==null;
  const saved=draft ? categories.find(category=>category.id===draft.id) : undefined;
  const baseline=saved ? fromDefinition(saved) : {name:'',englishName:'',parentId:null,position:0,audience:'staff',enabled:true,iconKey:null};
  const dirty=draft!==null && (draft.name!==baseline.name || (draft.englishName??'')!==baseline.englishName || draft.parentId!==baseline.parentId || draft.position!==baseline.position || draft.audience!==baseline.audience || draft.enabled!==baseline.enabled || draft.iconKey!==baseline.iconKey);
  const rows=hierarchy(categories);
  const excluded=draft ? descendants(categories,draft.id) : new Set<string>();
  const policyChanged=!!(saved && draft && (draft.parentId!==saved.parentId || draft.audience!==saved.audience || draft.enabled!==saved.enabled));

  useEffect(()=>{
    navigationConfirmed.current=false;
    if(!navigationLocked && !dirty)return;
    function warnBeforeLeaving(event:BeforeUnloadEvent) {
      if(navigationConfirmed.current)return;
      event.preventDefault();event.returnValue='';
    }
    async function guardNavigation(event:MouseEvent) {
      const target=event.target instanceof Element ? event.target.closest('a[href]') : null;
      if(!target || event.defaultPrevented || target.getAttribute('target')==='_blank' || event.ctrlKey || event.metaKey || event.shiftKey || target.hasAttribute('download'))return;
      const destination=new URL(target.getAttribute('href')!,window.location.href);
      if(destination.origin===window.location.origin && destination.pathname===window.location.pathname && destination.search===window.location.search && destination.hash)return;
      event.preventDefault();event.stopPropagation();
      if(navigationLocked || !await confirmAction('有尚未保存的分类修改。确定放弃这些修改并离开吗？')){event.preventDefault();event.stopPropagation();}
      else {navigationConfirmed.current=true;if(destination.origin===window.location.origin)router.push(destination.pathname+destination.search+destination.hash);else window.location.assign(destination.href);}
    }
    window.addEventListener('beforeunload',warnBeforeLeaving);
    document.addEventListener('click',guardNavigation,true);
    return ()=>{window.removeEventListener('beforeunload',warnBeforeLeaving);document.removeEventListener('click',guardNavigation,true);};
},[navigationLocked,dirty,router]);

  async function canDiscard(){return !dirty || await confirmAction('有尚未保存的分类修改。确定放弃这些修改吗？');}
  async function closeEditor(){if(lock.current || frozen || !await canDiscard())return;setDraft(null);setConflict(false);setNotice(null);}
  async function select(category?:CategoryDefinition){
    if(lock.current || frozen || (category && draft?.id===category.id) || !await canDiscard())return;
    setDraft(category ? fromDefinition(category) : {id:crypto.randomUUID(),expectedVersion:null,name:'',englishName:'',parentId:null,position:0,audience:'staff',enabled:true,iconKey:null});
    setConflict(false);setNotice(null);
  }
  function patch(value:Partial<Draft>){if(!lock.current && !frozen)setDraft(current=>current?{...current,...value}:current);}
  async function submit(event?:FormEvent){
    event?.preventDefault();
    if(lock.current || !draft || availability!=='ready' || (conflict && !pending))return;
    let operation=pending;
    const wasUncertain=pending!==null;
    if(!operation){
      try{operation={id:draft.id,write:parseCategoryWrite({expectedVersion:draft.expectedVersion,name:draft.name,englishName:draft.englishName??'',parentId:draft.parentId,position:draft.position,audience:draft.audience,enabled:draft.enabled,iconKey:draft.iconKey??null})};}
      catch{setNotice({kind:'error',text:'请填写 1–120 字的分类名称，排序需为 0–999999 的整数，并选择有效的父分类和访问范围。'});return;}
      if(policyChanged && !await confirmAction(`保存后，“${saved?.name}”及其子分类的访问限制将立即更新，影响已有正式内容的搜索、阅读、附件和 PDF。确定保存吗？`))return;
    }
    lock.current=true;setBusy(true);setPending(operation);setNotice(null);
    try{
      const result=await saveCategory(operation.id,operation.write);
      setCategories(current=>current.some(category=>category.id===result.id)?current.map(category=>category.id===result.id?result:category):[...current,result]);
      setDraft(fromDefinition(result));setPending(null);setConflict(false);
      setNotice({kind:'success',text:result.enabled?'分类设置已保存。当前访问限制已生效。':'分类已停用。关联内容及历史版本会保留，当前访问限制已生效。'});
    }catch(error){
      if(error instanceof CategoryWriteRejected && !wasUncertain){
        setPending(null);setConflict(error.message==='CATEGORY_CONFLICT');
        if(error.message==='FORBIDDEN')setAvailability('denied');
        setNotice({kind:'error',text:rejectionText[error.message]??'保存被拒绝，输入已保留。请检查设置后再试。'});
      }else{
        setConflict(error instanceof CategoryWriteRejected && error.message==='CATEGORY_CONFLICT');
        setNotice({kind:'error',text:error instanceof CategoryWriteRejected?'重试未能确认原提交结果，仍无法确认此前是否保存成功。可继续重试原提交，或载入最新设置核对；载入不会撤销此前的保存。':'暂时无法确认是否保存成功。原提交已锁定；可重试原提交，或载入最新设置核对。'});
      }
    }finally{lock.current=false;setBusy(false);}
  }
  async function reload(){
    if(lock.current)return;
    if((pending || dirty) && !await confirmAction(pending?'原提交可能已经保存。载入将用服务器当前设置替换本页输入，不会撤销此前的保存。确定载入吗？':'载入将放弃当前输入，并使用服务器最新设置。确定载入吗？'))return;
    lock.current=true;setBusy(true);setNotice(null);
    try{
      const latest=await readCategories();setCategories(latest);setAvailability('ready');
      if(draft){const current=latest.find(category=>category.id===draft.id);setDraft(current?fromDefinition(current):null);}
      const uncertain=pending!==null;
      setPending(null);setConflict(false);
      setNotice({kind:'success',text:uncertain?'已载入服务器当前分类设置。此前提交是否曾保存仍无法确认，请按当前设置核对。':'已载入最新分类设置。'});
    }catch(error){
      if(!pending && error instanceof Error && error.message==='FORBIDDEN')setAvailability('denied');
      setNotice({kind:'error',text:'暂时无法载入分类设置。当前输入和待确认提交仍保留，请稍后重试。'});
    }finally{lock.current=false;setBusy(false);}
  }

  function categoryBranch(category:CategoryDefinition,depth:number):ReactNode {
    const children=rows.filter(row=>row.category.parentId===category.id&&row.depth===depth+1);
    return <li key={category.id}><button type="button" className="category-settings-item" disabled={frozen} aria-pressed={draft?.id===category.id} onClick={()=>select(category)}><span className="category-tree-title"><span aria-hidden="true">{category.iconKey?<ReaderIcon icon={category.iconKey}/>:depth===0?'▱':'↳'}</span><strong>{category.name}</strong></span><span className="category-tree-meta">{depth===0?'主分类':'子分类'} · {category.enabled?'已启用':'已停用'}</span><small>实际访问：{effectivePolicy(categories,category)}</small></button>{children.length>0&&<ul aria-label={`${category.name}的子分类`}>{children.map(row=>categoryBranch(row.category,row.depth))}</ul>}</li>;
  }

  return <section className="category-settings" aria-label="分类设置" aria-busy={busy}>
    <header className="category-settings-heading"><div><h1>分类设置</h1><p>整理文章分类与子分类，为每个分类设置访问范围。</p></div>
      <a className="secondary-link" role="link" href={navigationLocked?undefined:'/admin/settings/history'} aria-disabled={navigationLocked||undefined} tabIndex={navigationLocked?-1:undefined}>设置变更记录</a>
    </header>
    <details className="category-settings-rules"><summary>分类规则与访问影响</summary><p className="category-settings-note">移动分类、修改范围或停用分类，会立即影响已有正式内容的搜索、阅读、附件和 PDF 访问。分类不删除，历史记录会保留。</p><p className="category-settings-note">子分类继承父分类限制；父分类停用，关联内容也不向员工开放。文章属于多个分类时，需满足全部分类限制。</p></details>
    {availability!=='ready' && <div className="category-settings-unavailable" role="status"><h2>{availability==='denied'?'没有管理权限':'分类设置暂时不可用'}</h2><p>{availability==='denied'?'只有管理员可以创建和修改分类。':'未能连接分类设置，当前无法确认已有分类。'}</p>{availability==='unavailable' && <button type="button" disabled={busy} onClick={()=>void reload()}>{busy?'正在载入…':'重新载入'}</button>}</div>}
    {availability==='ready' && <div className="category-settings-layout">
      <section className="category-settings-list" aria-labelledby="category-list-title">
        <div className="category-settings-toolbar"><h2 id="category-list-title">全部分类 <span>{categories.length} / 100</span></h2><button type="button" disabled={frozen||categories.length>=100} onClick={()=>select()}>新建分类</button></div>
        {categories.length===0?<p className="category-settings-empty">还没有分类。点击“新建分类”添加第一项。</p>:<ul className="category-tree" aria-label="分类层级">{rows.filter(row=>row.depth===0).map(row=>categoryBranch(row.category,row.depth))}</ul>}
        {categories.length>=100 && <p className="category-settings-note">已达到 100 项上限，包含已停用分类。</p>}
      </section>
      <section className="category-settings-editor" aria-labelledby="category-form-title"><h2 id="category-form-title">{draft?draft.expectedVersion===null?'新建分类':'编辑分类':'分类详情'}</h2>
        {!draft?<p className="category-settings-empty">从分类树选择一项，查看和编辑；或点击“新建分类”。</p>:<form onSubmit={submit}><fieldset disabled={frozen}><legend className="category-settings-sr">分类内容</legend>
          <label htmlFor="category-name">分类名称<input id="category-name" aria-label="分类名称" aria-describedby="category-name-help" value={draft.name} required maxLength={120} onChange={event=>patch({name:event.target.value})}/><small id="category-name-help">1–120 字，例如“运营流程”。</small></label>
          <label htmlFor="category-english-name">English label <input id="category-english-name" aria-label="English category label" value={draft.englishName??''} maxLength={120} onChange={event=>patch({englishName:event.target.value})}/><small>Write a natural English category name. Leave blank until it has been reviewed; the English directory will group it under “Other articles”.</small></label>
          <label htmlFor="category-icon">目录图标<select id="category-icon" aria-label="目录图标" value={draft.iconKey??''} onChange={event=>patch({iconKey:event.target.value?event.target.value as ReaderIconKey:null})}><option value="">自动选择</option>{Object.entries(readerIconLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><small>选择后，目录中的分类图标不再随名称变化。</small></label>
          <label htmlFor="category-parent">父分类<select id="category-parent" aria-label="父分类" aria-describedby="category-parent-help" value={draft.parentId??''} onChange={event=>patch({parentId:event.target.value||null})}><option value="">无父分类（顶层）</option>{rows.filter(({category})=>!excluded.has(category.id)).map(({category,depth})=><option value={category.id} key={category.id}>{'　'.repeat(depth)}{category.name}{category.enabled?'':'（已停用）'}</option>)}</select><small id="category-parent-help">不选父分类就是主分类；选择后会放在它下面，成为子分类。最多 10 层，不能选择自己或自己的子分类。</small></label>
          <label htmlFor="category-position">排序<input id="category-position" aria-label="排序" aria-describedby="category-position-help" type="number" min={0} max={999999} step={1} required value={Number.isNaN(draft.position)?'':draft.position} onChange={event=>patch({position:event.target.value===''?NaN:Number(event.target.value)})}/><small id="category-position-help">同一父分类下，数字越小越靠前。使用不同数字可指定顺序。</small></label>
          <label htmlFor="category-audience">本分类访问范围<select id="category-audience" aria-label="本分类访问范围" aria-describedby="category-audience-help" value={draft.audience} onChange={event=>patch({audience:event.target.value as CategoryWrite['audience']})}>{Object.entries(audiences).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><small id="category-audience-help">子分类会继承父分类限制，不能通过这里放宽权限；员工还需满足文章本身的权限。</small></label>
          <label className="category-settings-check"><input type="checkbox" checked={draft.enabled} onChange={event=>patch({enabled:event.target.checked})}/>启用分类</label>
          <p className="category-settings-policy">保存后实际访问：{effectivePolicy(categories,draft)}</p>
          {policyChanged && <p className="category-settings-message category-settings-message-error">此修改会立即影响已有正式内容及子分类的访问。保存前需要再次确认。</p>}
        </fieldset><div className="category-settings-actions">
          {pending?<button type="button" className="category-settings-primary" disabled={busy} onClick={()=>void submit()}>{busy?'正在确认保存…':'重试原提交'}</button>:<button type="submit" className="category-settings-primary" disabled={busy||conflict}>{busy?'正在保存…':'保存分类'}</button>}
          <button type="button" disabled={frozen} onClick={closeEditor}>关闭编辑</button>
          {(conflict||pending) && <button type="button" disabled={busy} onClick={()=>void reload()}>载入最新设置（替换当前输入）</button>}
        </div></form>}
      </section>
    </div>}
    {availability!=='ready' && draft && <p className="category-settings-note">尚未保存的分类“{draft.name||'未命名'}”仍保留在当前页面。</p>}
    {notice && <p className={`category-settings-message category-settings-message-${notice.kind}`} role={notice.kind==='error'?'alert':'status'}>{notice.text}</p>}
  </section>;
}
