'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {EnrollmentResult} from '../server/enrollment/service';
const messages={pending:'开通结果正在核对。请核对原来的申请，不要重复创建账号或修改角色。',waiting:'首次开通正在处理另一位同事的账号。完成后，你可以继续开通自己的访问。',error:'暂时无法完成开通，请稍后重新核对。',denied:'当前账号未通过开通检查，请联系管理员核实公司账号和角色。'};
type Outcome={state:'ready';role:string}|{state:'pending'|'waiting'|'error'|'denied'};
async function requestEnrollment():Promise<Outcome>{
 try{
  const response=await fetch('/api/auth/enrollment',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),result=await response.json();
  if(!response.ok)return {state:result.error==='FORBIDDEN'?'denied':'error'};
  if(result.status==='ready'&&['admin','support','ops'].includes(result.role))return {state:'ready',role:result.role};
  return {state:result.status==='pending'||result.status==='waiting'?result.status:'error'};
 }catch{return {state:'error'};}
}
export function EnrollmentPanel({initial}:{initial:EnrollmentResult}){
 const [state,setState]=useState<'working'|'pending'|'waiting'|'error'|'denied'|'ready'>('working');
 const [role,setRole]=useState('');const started=useRef(false);
 const complete=useCallback((result:Outcome)=>{
  setState(result.state);
  if(result.state==='ready'){setRole(result.role);window.location.reload();}
 },[]);
 useEffect(()=>{
  if(started.current)return;started.current=true;
  // Only an empty POST is sent. Identity and role are chosen by the server under its lock.
  if(initial.status!=='ready')void requestEnrollment().then(complete);
 },[initial.status,complete]);
 return <section className="enrollment-panel" aria-label="账号开通">
  <p role="status" className="connection-notice">{state==='working'?'正在核验公司账号并开通访问…':state==='ready'?`访问已开通（${role}），正在刷新页面。`:messages[state]}</p>
  {state!=='working'&&state!=='ready'&&state!=='denied'&&<button className="secondary-link" onClick={()=>{setState('working');void requestEnrollment().then(complete);}}>重新核对开通结果</button>}
  {state==='pending'&&<p className="access-policy">若持续无法完成，请联系身份服务管理员先确认原请求已结束，再处理原账号。不要自行清除记录或反复改角色。</p>}
  <p className="access-policy">首次初始化只会产生一位管理员。资料二审需要另一位管理员，不能自己审核自己提交的内容。</p>
 </section>;
}
