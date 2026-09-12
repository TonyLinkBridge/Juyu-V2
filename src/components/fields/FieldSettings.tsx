'use client';
import {confirmAction} from '../feedback/feedback';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {FieldWriteRejected, readFields, saveField} from '../../fields/client';
import {parseFieldWrite, type FieldDefinition, type FieldType, type FieldWrite} from '../../fields/model';

type Draft = {id:string; expectedVersion:number|null; name:string; type:FieldType; required:boolean; optionsText:string; enabled:boolean};
type Pending = {id:string; write:FieldWrite};
type Notice = {kind:'error'|'success'; text:string};
const types: Record<FieldType,string> = {text:'文本',number:'数字',date:'日期',select:'单选',boolean:'是 / 否'};
function fromDefinition(field:FieldDefinition):Draft {
  return {id:field.id,expectedVersion:field.version,name:field.name,type:field.type,required:field.required,optionsText:field.options.join('\n'),enabled:field.enabled};
}
const rejectionText: Record<string,string> = {
  FIELD_CONFLICT:'这项设置已有新版本。你的输入已保留；请重新载入最新设置，再确认修改。',
  FIELD_LIMIT:'字段总数已达到 30 项。可以编辑已有字段，停用字段也计入总数。',
  FORBIDDEN:'当前账号没有管理字段的权限。你的输入已保留。',
  INVALID_INPUT:'字段设置未通过校验。请检查名称、类型和单选选项后再保存。',
};

export function FieldSettings({initial = [], state = 'ready'}: {initial?:FieldDefinition[]; state?:'ready'|'unavailable'|'denied'}) {
  const [fields,setFields] = useState(initial);
  const [availability,setAvailability] = useState(state);
  const [draft,setDraft] = useState<Draft|null>(null);
  const [busy,setBusy] = useState(false);
  const [pending,setPending] = useState<Pending|null>(null);
  const [conflict,setConflict] = useState(false);
  const [notice,setNotice] = useState<Notice|null>(null);
  const lock = useRef(false);
  const frozen = busy || pending !== null || availability !== 'ready';
  const navigationLocked = busy || pending !== null;
  const saved = draft ? fields.find(field=>field.id===draft.id) : undefined;
  const baseline = saved ? fromDefinition(saved) : {name:'',type:'text',required:false,optionsText:'',enabled:true};
  const dirty = draft !== null && (draft.name!==baseline.name || draft.type!==baseline.type ||
    draft.required!==baseline.required || draft.optionsText!==baseline.optionsText || draft.enabled!==baseline.enabled);

  useEffect(()=>{
    if(!navigationLocked && !dirty)return;
    function warnBeforeLeaving(event:BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload',warnBeforeLeaving);
    return ()=>window.removeEventListener('beforeunload',warnBeforeLeaving);
  },[navigationLocked,dirty]);

  async function canDiscard() {
    return !dirty || await confirmAction('有尚未保存的字段修改。确定放弃这些修改吗？');
  }
  async function closeEditor() {
    if(lock.current || frozen || !await canDiscard())return;
    setDraft(null);setConflict(false);setNotice(null);
  }

  async function select(field?:FieldDefinition) {
    if (lock.current || frozen || (field && draft?.id===field.id) || !await canDiscard()) return;
    setDraft(field ? fromDefinition(field) : {id:crypto.randomUUID(),expectedVersion:null,name:'',type:'text',required:false,optionsText:'',enabled:true});
    setConflict(false);setNotice(null);
  }
  function patch(value:Partial<Draft>) {
    if (!lock.current && !frozen) setDraft(current=>current ? {...current,...value} : current);
  }
  async function submit(event?:FormEvent) {
    event?.preventDefault();
    if (lock.current || !draft || availability !== 'ready' || conflict) return;
    let operation = pending;
    if (!operation) {
      try {
        operation = {id:draft.id,write:parseFieldWrite({expectedVersion:draft.expectedVersion,name:draft.name,type:draft.type,required:draft.required,enabled:draft.enabled,options:draft.type==='select' ? draft.optionsText.split('\n') : []})};
      } catch {
        setNotice({kind:'error',text:'请填写 1–80 字的名称；单选需填写 1–30 个不重复的选项，每行一项，每项 1–80 字。'});return;
      }
    }
    lock.current = true;setBusy(true);setPending(operation);setNotice(null);
    try {
      const saved = await saveField(operation.id,operation.write);
      setFields(current=>current.some(field=>field.id===saved.id) ? current.map(field=>field.id===saved.id?saved:field) : [...current,saved]);
      setDraft(fromDefinition(saved));setPending(null);setConflict(false);
      setNotice({kind:'success',text:saved.enabled ? '字段设置已保存。文章下次编辑时会使用这项设置。' : '字段已停用。已有文章和历史版本中的字段内容仍会保留。'});
    } catch(error) {
      if(error instanceof FieldWriteRejected) {
        setPending(null);setConflict(error.message==='FIELD_CONFLICT');
        if(error.message==='FORBIDDEN')setAvailability('denied');
        setNotice({kind:'error',text:rejectionText[error.message] ?? '保存被拒绝，输入已保留。请检查设置后再试。'});
      } else {
        setNotice({kind:'error',text:'暂时无法确认是否保存成功。原提交内容已锁定，请重试确认结果。'});
      }
    } finally {lock.current=false;setBusy(false);}
  }
  async function reload() {
    if(lock.current || pending)return;
    lock.current=true;setBusy(true);setNotice(null);
    try {
      const latest=await readFields();setFields(latest);setAvailability('ready');
      if(draft) {
        const current=latest.find(field=>field.id===draft.id);
        setDraft(current?fromDefinition(current):null);
      }
      setConflict(false);setNotice({kind:'success',text:'已载入最新字段设置。'});
    } catch(error) {
      if(error instanceof Error && error.message==='FORBIDDEN')setAvailability('denied');
      setNotice({kind:'error',text:'暂时无法载入字段设置。当前输入仍保留，请稍后重试。'});
    } finally {lock.current=false;setBusy(false);}
  }

  return <section className="field-settings" aria-label="文章自定义字段" aria-busy={busy}>
    <header className="field-settings-heading">
      <div><h1>自定义字段</h1><p>为各类文章添加补充信息。字段值随草稿保存，经过文章审核后发布。</p></div>
      <a className="secondary-link" role="link" href={navigationLocked?undefined:"/admin/settings/history"} aria-disabled={navigationLocked || undefined} tabIndex={navigationLocked?-1:undefined} onClick={event=>{if(lock.current || pending)event.preventDefault();}}>设置变更记录</a>
    </header>
    <p className="field-settings-note">修改设置不会改写已发布文章或历史版本。停用后不再要求填写，已有内容会保留。</p>
    {availability!=='ready' && <div className="field-settings-unavailable" role="status">
      <h2>{availability==='denied'?'没有管理权限':'字段设置暂时不可用'}</h2>
      <p>{availability==='denied'?'只有管理员可以创建和修改字段。':'未能连接字段设置，当前无法确认已有字段。'}</p>
      {availability==='unavailable' && <button type="button" disabled={busy} onClick={()=>void reload()}>{busy?'正在载入…':'重新载入'}</button>}
    </div>}
    {availability==='ready' && <div className="field-settings-layout">
      <section className="field-settings-list" aria-labelledby="field-list-title">
        <div className="field-settings-toolbar"><h2 id="field-list-title">全部字段 <span>{fields.length} / 30</span></h2>
          <button type="button" onClick={()=>select()} disabled={frozen || fields.length>=30}>新建字段</button></div>
        {fields.length===0 ? <p className="field-settings-empty">还没有自定义字段。点击“新建字段”添加第一项。</p> : <ul>{fields.map(field=><li key={field.id}>
          <button type="button" className="field-settings-item" disabled={frozen} aria-pressed={draft?.id===field.id} onClick={()=>select(field)}>
            <strong>{field.name}</strong><span>{types[field.type]} · {field.required?'必填':'选填'} · {field.enabled?'已启用':'已停用'}</span>
          </button>
        </li>)}</ul>}
        {fields.length>=30 && <p className="field-settings-note">已达到 30 项上限，包含已停用字段。</p>}
      </section>
      <section className="field-settings-editor" aria-labelledby="field-form-title">
        <h2 id="field-form-title">{draft ? draft.expectedVersion===null?'新建字段':'编辑字段' : '字段设置'}</h2>
        {!draft ? <p className="field-settings-empty">选择已有字段，或新建一项。</p> : <form onSubmit={submit}>
          <fieldset disabled={frozen}>
            <legend className="field-settings-sr">字段内容</legend>
            <label htmlFor="field-name">字段名称<input id="field-name" value={draft.name} required onChange={event=>patch({name:event.target.value})} aria-describedby="field-name-help"/><small id="field-name-help">1–80 字，例如“所属团队”。</small></label>
            <label htmlFor="field-type">字段类型<select id="field-type" value={draft.type} disabled={draft.expectedVersion!==null || frozen} onChange={event=>patch({type:event.target.value as FieldType})}>{Object.entries(types).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><small>创建后不能修改类型。需要其他类型时，请新建字段。</small></label>
            {draft.type==='select' && <label htmlFor="field-options">单选选项<textarea id="field-options" rows={5} value={draft.optionsText} required onChange={event=>patch({optionsText:event.target.value})} aria-describedby="field-options-help"/><small id="field-options-help">每行一项，1–30 个不重复的选项，每项最多 80 字。</small></label>}
            <label className="field-settings-check"><input type="checkbox" checked={draft.required} onChange={event=>patch({required:event.target.checked})}/>设为必填</label>
            <label className="field-settings-check"><input type="checkbox" checked={draft.enabled} onChange={event=>patch({enabled:event.target.checked})}/>启用字段</label>
            <p className="field-settings-note">取消“启用字段”即可停用；历史内容会保留，也可以再次启用。</p>
          </fieldset>
          <div className="field-settings-actions">
            {pending ? <button className="field-settings-primary" type="button" disabled={busy} onClick={()=>void submit()}>{busy?'正在确认保存…':'重试原提交'}</button> : <button className="field-settings-primary" type="submit" disabled={busy || conflict}>{busy?'正在保存…':'保存字段'}</button>}
            <button type="button" disabled={frozen} onClick={closeEditor}>关闭编辑</button>
            {conflict && <button type="button" disabled={busy} onClick={()=>void reload()}>重新载入最新设置（放弃当前输入）</button>}
          </div>
        </form>}
      </section>
    </div>}
    {availability!=='ready' && draft && <p className="field-settings-note">尚未保存的字段“{draft.name || '未命名'}”仍保留在当前页面。</p>}
    {notice && <p className={`field-settings-message field-settings-message-${notice.kind}`} role={notice.kind==='error'?'alert':'status'}>{notice.text}</p>}
  </section>;
}
