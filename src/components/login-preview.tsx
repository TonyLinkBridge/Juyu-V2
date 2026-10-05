"use client";
import {useId, useState} from 'react';
import Image from 'next/image';
import {ArrowRight, ChevronUp, Mail} from 'lucide-react';

// Existing development-only design route. This never creates a login session.
export function LoginPreview() {
  const [email,setEmail]=useState(false);
  const [notice,setNotice]=useState(false);
  const formId=useId();
  return <div className="login-auth">
    <button type="button" className="cl-socialButtonsBlockButton login-preview-slack" onClick={()=>setNotice(true)}>
      <Image src="/brand/slack-color.svg" alt="" width={23} height={23} unoptimized/>使用 Slack 登录
    </button>
    {notice&&<p role="status" className="login-preview-note">外观预览不会启动登录。正式入口由 Clerk 验证公司账号。</p>}
    <p className="login-slack-help">使用公司 Slack 账号继续</p>
    <div className="login-divider" aria-hidden="true"><span/><span>或</span><span/></div>
    <button className="login-email-toggle" type="button" aria-expanded={email} aria-controls={formId} onClick={()=>setEmail(!email)}>
      <Mail size={17} aria-hidden="true"/>{email?'收起邮箱登录':'使用邮箱登录'}{email?<ChevronUp size={16} aria-hidden="true"/>:<ArrowRight size={16} aria-hidden="true"/>}
    </button>
    {email&&<label id={formId} className="login-preview-email">公司邮箱<input type="email" placeholder="name@juyu.com"/><small>此处仅预览，实际登录由 Clerk 处理。</small></label>}
  </div>;
}
