'use client';

/* eslint-disable @next/next/no-img-element -- Static source brand assets; private-media optimizer remains disabled. */

import {createContext,useContext,type ReactNode} from 'react';
import Link from 'next/link';
import {NavigationLink} from './NavigationLink';
import {usePathname,useSearchParams} from 'next/navigation';
import {Files,Clock,ImageSquare,Users,Gear,ArrowUpRight,List,Archive,ChartBar,ChatCircle,Trash} from '@phosphor-icons/react';
import {AccountMenu} from './AccountControls';

export {AccountMenu} from './AccountControls';

const InAdminFrame=createContext(false);
export const InReaderFrame=createContext(false);

/** Presentation only: page and data authorization remain on the server. */
export function ShellSlot({children,chrome,footer,navigation}:{children:ReactNode;chrome:ReactNode;footer:ReactNode;navigation?:ReactNode}){
 const admin=useContext(InAdminFrame),reader=useContext(InReaderFrame);
 if(admin||reader)return <>{children}</>;
 return <div className={navigation?'entry-frame knowledge-shell':'entry-frame'}><a className="skip-link" href="#main-content">跳到主要内容</a>{chrome}{navigation?<div className="knowledge-body"><aside className="knowledge-sidebar">{navigation}</aside><div className="knowledge-content">{children}</div></div>:children}{footer}</div>;
}

export function Brand({locale='zh-CN'}:{locale?:'zh-CN'|'en'}){return <Link href={locale==='en'?'/help-centre?lang=en':'/help-centre'} className="juyu-brand" aria-label={locale==='en'?'JUYU Help Centre home':'聚域 Help Centre 首页'}><img className="logo-light" src="/brand/juyu-logo-color.png" alt="聚域"/><img className="logo-dark" src="/brand/juyu-logo-white.png" alt="聚域"/><span>Help Centre</span></Link>;}

const links=[['/admin','知识文章',Files],['/admin?kind=ops&view=list','OPS 内容管理',Files],['/admin?kind=reference&view=list','Reference 管理',Files],['/admin?kind=qa&view=list','Q&A 管理',ChatCircle],['/admin?scope=review&view=list','待我审核',Clock],['/admin/media','媒体文件',ImageSquare],['/admin/members','成员与权限',Users],['/admin/analytics','使用分析',ChartBar],['/admin/feedback','文章反馈',ChatCircle],['/admin/availability','归档资料',Archive],['/admin/trash','回收站',Trash]] as const;

export function AdminFrame({children,accountEnabled=false}:{children:ReactNode;accountEnabled?:boolean}){
 const path=usePathname();
 if(path.startsWith('/admin/sign-in'))return <>{children}</>;
 return <InAdminFrame.Provider value={true}><div className={`admin-frame${path==='/admin/editor'?' is-editor':''}`}><a className="skip-link" href="#main-content">跳到主要内容</a><header className="app-topbar"><Brand/><span className="app-badge">管理后台</span><Link prefetch={false} href="/help-centre" className="library-link">员工资料库 <ArrowUpRight size={16}/></Link><AccountMenu admin enabled={accountEnabled}/></header><aside className="admin-sidebar"><details className="admin-mobile-nav"><summary><List size={20}/> 管理导航</summary><Sidebar path={path}/></details><div className="admin-desktop-nav"><Sidebar path={path}/></div></aside><div className="admin-page-content">{children}</div></div></InAdminFrame.Provider>;
}

function Sidebar({path}:{path:string}){
 const params=useSearchParams();const reviewing=path==='/admin'&&params.get('scope')==='review';
 return <nav aria-label="后台导航"><div className="sidebar-nav-group">{links.map(([href,label,Icon])=><NavigationLink prefetch={false} prefetchOnIntent href={href} key={href} aria-current={(href.includes('kind=')?path==='/admin'&&!reviewing&&params.get('kind')===new URLSearchParams(href.split('?')[1]).get('kind'):href.includes('?')?reviewing:href===path&&!(href==='/admin'&&(reviewing||['qa','ops','reference'].includes(params.get('kind')??''))))?'page':undefined}><Icon size={20}/>{label}</NavigationLink>)}</div><details className="settings-nav" open={path.startsWith('/admin/settings')||path==='/admin/forms'||path==='/admin/announcements'}><summary><Gear size={20}/>设置</summary>{[['features','功能开关'],['navigation','导航设置'],['categories','分类设置'],['fields','自定义字段'],['forms','自定义表单'],['history','设置变更记录']].map(([id,title])=><NavigationLink prefetch={false} prefetchOnIntent key={id} href={`/admin/settings/${id}`} aria-current={path===`/admin/settings/${id}`?'page':undefined}>{title}</NavigationLink>)}<NavigationLink prefetch={false} prefetchOnIntent href="/admin/announcements">公告管理</NavigationLink><NavigationLink prefetch={false} prefetchOnIntent href="/admin/forms">表单提交记录</NavigationLink></details></nav>;
}
