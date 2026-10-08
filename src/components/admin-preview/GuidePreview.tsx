"use client";
import {useState} from 'react';
import {GuideDialog} from '../onboarding/UsageGuide';
import {defaultFeatureFlags} from '../../features/model';
export function GuidePreview(){
 const [mode,setMode]=useState<'employee'|'admin'|'super_admin'|null>(null);
 return <section><h1>使用指南</h1><p>本地示例：与正式账号菜单使用相同的 Cult 引导组件。以下角色与功能开关均为预览样例。</p><div className="editor-settings-actions">{([['employee','员工使用指南'],['admin','管理员使用指南'],['super_admin','Super Admin 使用指南']] as const).map(([id,label])=><button type="button" key={id} onClick={()=>setMode(id)}>{label}</button>)}</div>{mode&&<GuideDialog admin={mode!=='employee'} adminRole={mode==='employee'?null:mode} flags={defaultFeatureFlags} onClose={()=>setMode(null)}/>}</section>;
}
