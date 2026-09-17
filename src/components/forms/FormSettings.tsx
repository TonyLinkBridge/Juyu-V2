'use client';
import {confirmAction} from '../feedback/feedback';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {FormWriteRejected,readFormSettings,saveForm} from '../../forms/settings-client';
import {parseFormWrite,type FormDefinition,type FormWrite,type FormField} from '../../forms/model';
import type {FieldDefinition} from '../../fields/model';

type Draft=Omit<FormDefinition,'version'>&{expectedVersion:number|null};
type Pending={id:string;write:FormWrite;fields:FieldDefinition[]};
type Notice={kind:'error'|'success';text:string};
const audiences={staff:'全体员工',ops:'运营和管理员',admin:'仅管理员'};
const types={text:'文本',number:'数字',date:'日期',select:'单选',boolean:'是 / 否'};
function fromDefinition(form:FormDefinition):Draft{const {version,...rest}=form;return {...rest,expectedVersion:version,fields:form.fields.map(item=>({...item,field:{...item.field,options:[...item.field.options]}}))};}
function emptyDraft(id:string):Draft{return {id,expectedVersion:null,title:'',description:'',audience:'staff',enabled:false,fields:[]};}
function sameDraft(left:Draft,right:Draft){return left.title===right.title&&left.description===right.description&&left.audience===right.audience&&left.enabled===right.enabled&&JSON.stringify(left.fields)===JSON.stringify(right.fields);}
const rejectionText:Record<string,string>={
 FORM_CONFLICT:'这张表单已有新版本。当前输入已保留；请载入最新设置，再确认修改。',
 FIELD_CONFLICT:'选用的字段版本已有变化或已停用。当前输入已保留；请载入最新设置后重新选择。',
 FORM_LIMIT:'表单已达到 50 张上限，停用表单也计入总数。',
 FORBIDDEN:'当前账号没有管理表单的权限。你的输入已保留。',
 INVALID_INPUT:'表单设置未通过校验。请检查标题、说明和字段配置。',
};

export function FormSettings({initial=[],definitions=[],state='ready'}:{initial?:FormDefinition[];definitions?:FieldDefinition[];state?:'ready'|'unavailable'|'denied'}){
 const router=useRouter();
 const [forms,setForms]=useState(initial);
 const [fields,setFields]=useState(definitions);
 const [availability,setAvailability]=useState(state);
 const [draft,setDraft]=useState<Draft|null>(null);
 const [selectedField,setSelectedField]=useState('');
 const [busy,setBusy]=useState(false);
 const [pending,setPending]=useState<Pending|null>(null);
 const [conflict,setConflict]=useState(false);
 const [notice,setNotice]=useState<Notice|null>(null);
 const lock=useRef(false);
 const navigationConfirmed=useRef(false);
 const frozen=busy||pending!==null||availability!=='ready';
 const navigationLocked=busy||pending!==null;
 const saved=draft?forms.find(form=>form.id===draft.id):undefined;
 const dirty=!!(draft&&!sameDraft(draft,saved?fromDefinition(saved):emptyDraft(draft.id)));
 const availableFields=fields.filter(field=>field.enabled&&!draft?.fields.some(item=>item.field.id===field.id));
 const policyChanged=!!(draft&&(saved?(draft.enabled!==saved.enabled||draft.audience!==saved.audience):draft.enabled));

 useEffect(()=>{
  navigationConfirmed.current=false;
  if(!navigationLocked&&!dirty)return;
  function warnBeforeLeaving(event:BeforeUnloadEvent){if(navigationConfirmed.current)return;event.preventDefault();event.returnValue='';}
  async function guardNavigation(event:MouseEvent){
   const target=event.target instanceof Element?event.target.closest('a[href]'):null;
   if(!target||event.defaultPrevented||target.getAttribute('target')==='_blank'||event.ctrlKey||event.metaKey||event.shiftKey||target.hasAttribute('download'))return;
   const destination=new URL(target.getAttribute('href')!,window.location.href);
   if(destination.origin===window.location.origin&&destination.pathname===window.location.pathname&&destination.search===window.location.search&&destination.hash)return;
   event.preventDefault();event.stopPropagation();
   if(navigationLocked||!await confirmAction('有尚未保存的表单修改。确定放弃这些修改并离开吗？')){event.preventDefault();event.stopPropagation();}
   else {navigationConfirmed.current=true;if(destination.origin===window.location.origin)router.push(destination.pathname+destination.search+destination.hash);else window.location.assign(destination.href);}
  }
  window.addEventListener('beforeunload',warnBeforeLeaving);document.addEventListener('click',guardNavigation,true);
  return ()=>{window.removeEventListener('beforeunload',warnBeforeLeaving);document.removeEventListener('click',guardNavigation,true);};
  },[navigationLocked,dirty,router]);

 async function canDiscard(){return !dirty||await confirmAction('有尚未保存的表单修改。确定放弃这些修改吗？');}
 async function select(form?:FormDefinition){
  if(lock.current||frozen||(form&&draft?.id===form.id)||!await canDiscard())return;
  setDraft(form?fromDefinition(form):emptyDraft(crypto.randomUUID()));setSelectedField('');setConflict(false);setNotice(null);
 }
 async function closeEditor(){if(lock.current||frozen||!await canDiscard())return;setDraft(null);setSelectedField('');setConflict(false);setNotice(null);}
 function patch(value:Partial<Draft>){if(!lock.current&&!frozen)setDraft(current=>current?{...current,...value}:current);}
 function changeField(index:number,value:Partial<Pick<FormField,'required'|'width'>>){if(draft)patch({fields:draft.fields.map((item,i)=>i===index?{...item,...value}:item)});}
 function moveField(index:number,direction:-1|1){
  if(!draft)return;const next=index+direction;if(next<0||next>=draft.fields.length)return;
  const items=[...draft.fields];[items[index],items[next]]=[items[next],items[index]];patch({fields:items});
 }
 function addField(){
  if(!draft||frozen||lock.current||draft.fields.length>=20)return;
  const field=availableFields.find(item=>item.id===selectedField);if(!field)return;
  patch({fields:[...draft.fields,{field:{...field,options:[...field.options]},required:field.required,width:'full'}]});setSelectedField('');
 }
 function refreshField(index:number){
  if(!draft||frozen||lock.current)return;
  const current=fields.find(field=>field.id===draft.fields[index].field.id);
  if(!current?.enabled)return;
  patch({fields:draft.fields.map((item,i)=>i===index?{...item,field:{...current,options:[...current.options]}}:item)});
 }
 async function submit(event?:FormEvent){
  event?.preventDefault();if(lock.current||!draft||availability!=='ready'||(conflict&&!pending))return;
  let operation=pending;const wasUncertain=pending!==null;
  if(!operation){
   try{operation={id:draft.id,write:parseFormWrite({expectedVersion:draft.expectedVersion,title:draft.title,description:draft.description,audience:draft.audience,enabled:draft.enabled,fields:draft.fields.map(item=>({id:item.field.id,version:item.field.version,required:item.required,width:item.width}))}),fields:draft.fields.map(item=>({...item.field,options:[...item.field.options]}))};}
   catch{setNotice({kind:'error',text:'请填写 1–120 字的标题，说明不超过 2000 字，并选择 1–20 个不重复的字段。'});return;}
   if(policyChanged&&!await confirmAction(`保存后，“${draft.title}”的设置会立即生效：${draft.enabled?`向${audiences[draft.audience]}开放填写`:"停止开放填写"}。表单不经过文章审核，已有提交记录会保留。确定保存吗？`))return;
  }
  lock.current=true;setBusy(true);setPending(operation);setNotice(null);
  try{
   const result=await saveForm(operation.id,operation.write,operation.fields);
   setForms(current=>current.some(form=>form.id===result.id)?current.map(form=>form.id===result.id?result:form):[...current,result]);
   setDraft(fromDefinition(result));setPending(null);setConflict(false);setSelectedField('');
   setNotice({kind:'success',text:result.enabled?'表单已保存并启用，指定范围内的员工可以填写。':'表单已保存为停用状态。已有提交记录会保留。'});
  }catch(error){
   if(error instanceof FormWriteRejected&&!wasUncertain){
    setPending(null);setConflict(error.message==='FORM_CONFLICT'||error.message==='FIELD_CONFLICT');
    if(error.message==='FORBIDDEN')setAvailability('denied');
    setNotice({kind:'error',text:rejectionText[error.message]??'保存被拒绝，当前输入已保留。请检查后重试。'});
   }else{
    setConflict(error instanceof FormWriteRejected&&(error.message==='FORM_CONFLICT'||error.message==='FIELD_CONFLICT'));
    setNotice({kind:'error',text:error instanceof FormWriteRejected?'重试未能确认原提交结果，仍无法确认此前是否保存成功。可以重试原提交，或载入最新设置核对；载入不会撤销此前的保存。':'暂时无法确认是否保存成功。原提交及字段版本已锁定；请重试原提交，或载入最新设置核对。'});
   }
  }finally{lock.current=false;setBusy(false);}
 }
 async function reload(){
  if(lock.current)return;
  if((pending||dirty)&&!await confirmAction(pending?'原提交可能已经保存。载入将用服务器当前表单和字段设置替换本页输入，不会撤销此前的保存。确定载入吗？':'载入将放弃当前输入，并使用服务器最新表单和字段设置。确定载入吗？'))return;
  lock.current=true;setBusy(true);setNotice(null);
  try{
   const latest=await readFormSettings();setForms(latest.forms);setFields(latest.definitions);setAvailability('ready');
   if(draft){const current=latest.forms.find(form=>form.id===draft.id);setDraft(current?fromDefinition(current):null);}
   const uncertain=pending!==null;setPending(null);setConflict(false);setSelectedField('');
   setNotice({kind:'success',text:uncertain?'已载入服务器当前表单和字段设置。此前提交是否曾保存仍无法确认，请按当前设置核对。':'已载入最新表单和字段设置。已有表单仍保留原字段版本，可主动更新。'});
  }catch(error){
   if(!pending&&error instanceof Error&&error.message==='FORBIDDEN')setAvailability('denied');
   setNotice({kind:'error',text:'暂时无法完整载入表单和字段设置。当前输入和待确认提交仍保留，请稍后重试。'});
  }finally{lock.current=false;setBusy(false);}
 }

 return <section className="form-settings" aria-label="自定义表单设置" aria-busy={busy}>
  <header className="form-settings-heading"><div><h1>自定义表单</h1><p>选择已有字段，设置填写顺序、必填规则和布局。</p></div><a className="secondary-link" role="link" href={navigationLocked?undefined:'/admin/settings/history'} aria-disabled={navigationLocked||undefined} tabIndex={navigationLocked?-1:undefined}>设置变更记录</a></header>
  <details className="form-settings-help"><summary>使用说明</summary><p className="form-settings-note">表单独立于文章审核。管理员保存并启用后，指定范围内的员工即可填写；之后的配置修改立即生效，已有提交保留当时的内容。</p>
  <p className="form-settings-note">每张表单保留所选字段的版本。字段改名或停用不会自动改变已有表单；需要时可主动更新为最新字段。</p></details>
  {availability!=='ready'&&<div className="form-settings-unavailable" role="status"><h2>{availability==='denied'?'没有管理权限':'表单设置暂时不可用'}</h2><p>{availability==='denied'?'只有管理员可以创建和修改表单。':'未能完整载入表单和字段设置，当前无法确认已有配置。'}</p>{availability==='unavailable'&&<button type="button" disabled={busy} onClick={()=>void reload()}>{busy?'正在载入…':'重新载入'}</button>}</div>}
  {availability==='ready'&&<div className={`form-settings-layout ${!draft&&!forms.length?'is-empty':''}`}>
   <section className="form-settings-list" aria-labelledby="form-list-title"><div className="form-settings-toolbar"><h2 id="form-list-title">全部表单 <span>{forms.length} / 50</span></h2><button type="button" disabled={frozen||forms.length>=50} onClick={()=>select()}>新建表单</button></div>
    {forms.length===0?<p className="form-settings-empty">还没有表单。点击“新建表单”添加第一张。</p>:<ul>{forms.map(form=><li key={form.id}><button type="button" className="form-settings-item" disabled={frozen} aria-pressed={draft?.id===form.id} onClick={()=>select(form)}><strong>{form.title}</strong><span>{form.fields.length} 个字段 · {audiences[form.audience]} · {form.enabled?'已启用':'已停用'}</span></button></li>)}</ul>}
    {forms.length>=50&&<p className="form-settings-note">已达到 50 张上限，包含已停用表单。</p>}
    <button type="button" className="form-settings-refresh" disabled={busy} onClick={()=>void reload()}>载入最新表单和字段</button>
   </section>
   {(draft||forms.length>0)&&<section className="form-settings-editor" aria-labelledby="form-editor-title"><h2 id="form-editor-title">{draft?draft.expectedVersion===null?'新建表单':'编辑表单':'表单配置'}</h2>
    {!draft?<p className="form-settings-empty">选择已有表单，或新建一张。</p>:<form onSubmit={submit}>
     <fieldset disabled={frozen}><legend className="form-settings-sr">表单配置内容</legend>
      <label htmlFor="form-title">表单标题<input id="form-title" aria-label="表单标题" value={draft.title} required onChange={event=>patch({title:event.target.value})}/></label>
      <label htmlFor="form-description">填写说明<textarea id="form-description" aria-label="填写说明" rows={3} value={draft.description} onChange={event=>patch({description:event.target.value})}/></label>
      <label htmlFor="form-audience">填写范围<select id="form-audience" aria-label="填写范围" value={draft.audience} onChange={event=>patch({audience:event.target.value as FormWrite['audience']})}>{Object.entries(audiences).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
      <label className="form-settings-check"><input type="checkbox" checked={draft.enabled} onChange={event=>patch({enabled:event.target.checked})}/>启用表单</label>
      {policyChanged&&<p className="form-settings-message form-settings-message-error">此修改会立即改变表单的开放状态或填写范围。保存前需要再次确认。</p>}
      <div className="form-settings-fields-heading"><h3>已选字段 <span>{draft.fields.length} / 20</span></h3><p className="form-settings-note">必填规则只用于这张表单。桌面可排成两栏，手机自动单栏。</p></div>
      {draft.fields.length===0?<p className="form-settings-empty">至少选择一个字段。</p>:<ol className="form-settings-bindings">{draft.fields.map((item,index)=>{
       const latest=fields.find(field=>field.id===item.field.id);
       const hasUpdate=latest?.enabled&&latest.version!==item.field.version;
       return <li key={item.field.id} data-field-id={item.field.id}><div className="form-settings-binding-heading"><strong>{index+1}. {item.field.name}</strong><span>{types[item.field.type]} · 字段版本 {item.field.version}</span></div>
        {hasUpdate&&<div className="form-settings-field-warning"><p>当前字段已更新为“{latest.name}”（版本 {latest.version}），此表单仍使用原版本。</p><button type="button" onClick={()=>refreshField(index)}>更新为最新字段</button></div>}
        {!latest?.enabled&&<p className="form-settings-field-warning">{latest?'此字段目前已停用':'此字段的当前配置不可用'}；表单保留原版本，仍可使用。也可移除本项。</p>}
        <div className="form-settings-binding-options"><label className="form-settings-check"><input type="checkbox" aria-label={`${item.field.name}设为必填`} checked={item.required} onChange={event=>changeField(index,{required:event.target.checked})}/>设为必填</label><label>布局宽度<select aria-label={`${item.field.name}布局宽度`} value={item.width} onChange={event=>changeField(index,{width:event.target.value as FormField['width']})}><option value="full">整行</option><option value="half">半行</option></select></label></div>
        <div className="form-settings-binding-actions"><button type="button" disabled={frozen||index===0} onClick={()=>moveField(index,-1)}>上移</button><button type="button" disabled={frozen||index===draft.fields.length-1} onClick={()=>moveField(index,1)}>下移</button><button type="button" onClick={()=>patch({fields:draft.fields.filter((_,i)=>i!==index)})}>移除</button></div>
       </li>;
      })}</ol>}
      <div className="form-settings-add"><label htmlFor="form-add-field">添加字段<select id="form-add-field" aria-label="添加字段" value={selectedField} disabled={frozen||draft.fields.length>=20||availableFields.length===0} onChange={event=>setSelectedField(event.target.value)}><option value="">选择已有的启用字段</option>{availableFields.map(field=><option value={field.id} key={field.id}>{field.name}（{types[field.type]}）</option>)}</select></label><button type="button" disabled={frozen||!selectedField||draft.fields.length>=20} onClick={addField}>添加到表单</button></div>
      {availableFields.length===0&&<p className="form-settings-note">暂无可添加的启用字段。可前往 <a href="/admin/settings/fields">自定义字段设置</a> 创建或启用字段。</p>}
     </fieldset>
     <section className="form-settings-preview" aria-labelledby="form-preview-title"><h3 id="form-preview-title">填写预览</h3><p className="form-settings-note">仅预览布局，不会提交数据。</p><h4>{draft.title||'未命名表单'}</h4>{draft.description&&<p className="form-settings-preview-description">{draft.description}</p>}
      <fieldset disabled><legend className="form-settings-sr">表单填写预览</legend><div className="form-settings-preview-fields">{draft.fields.map(item=><label key={item.field.id} className={`form-settings-preview-${item.width}`}><span>{item.field.name}{item.required&&<strong> * 必填</strong>}</span>{item.field.type==='select'?<select aria-label={`${item.field.name}（预览）`} defaultValue=""><option value="">请选择</option>{item.field.options.map(option=><option key={option}>{option}</option>)}</select>:item.field.type==='boolean'?<select aria-label={`${item.field.name}（预览）`} defaultValue=""><option value="">请选择</option><option>是</option><option>否</option></select>:<input aria-label={`${item.field.name}（预览）`} type={item.field.type} placeholder="填写内容"/>}</label>)}</div></fieldset>
     </section>
     <div className="form-settings-actions">{pending?<button type="button" className="form-settings-primary" disabled={busy} onClick={()=>void submit()}>{busy?'正在确认保存…':'重试原提交'}</button>:<button type="submit" className="form-settings-primary" disabled={busy||conflict}>{busy?'正在保存…':'保存表单'}</button>}<button type="button" disabled={frozen} onClick={closeEditor}>关闭编辑</button>{(conflict||pending)&&<button type="button" disabled={busy} onClick={()=>void reload()}>载入最新设置（替换当前输入）</button>}</div>
    </form>}
   </section>}
  </div>}
  {availability!=='ready'&&draft&&<p className="form-settings-note">尚未保存的表单“{draft.title||'未命名'}”仍保留在当前页面。</p>}
  {notice&&<p className={`form-settings-message form-settings-message-${notice.kind}`} role={notice.kind==='error'?'alert':'status'}>{notice.text}</p>}
 </section>;
}
