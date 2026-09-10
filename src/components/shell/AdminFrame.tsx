'use client';
/* eslint-disable @next/next/no-img-element -- Static source brand assets; private-media optimizer remains disabled. */
import {createContext,useContext,type ReactNode} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {House,Files,Clock,ImageSquare,Users,Gear,ArrowUpRight,List,Archive,ChartBar,ChatCircle,Trash} from '@phosphor-icons/react';
import {ThemeToggler} from '../gitbook/ThemeToggler/ThemeToggler';
import {AccountMenu} from './AccountControls';
export {AccountMenu} from './AccountControls';
const InAdminFrame=createContext(false);
/** Presentation only: page and data authorization remain on the server. */
export function ShellSlot({children,chrome,footer,navigation}:{children:ReactNode;chrome:ReactNode;footer:ReactNode;navigation?:ReactNode}){
 if(useContext(InAdminFrame))return <>{children}</>;
 return <div className={navigation?'entry-frame knowledge-shell':'entry-frame'}><a className="skip-link" href="#main-content">跳到主要内容</a>{chrome}{navigation?<div className="knowledge-body"><aside className="knowledge-sidebar">{navigation}</aside><div className="knowledge-content">{children}</div></div>:children}{footer}</div>;
}
export function Brand(){return <Link href="/help-centre" className="juyu-brand" aria-label="聚域 Help Centre 首页"><img className="logo-light" src="/brand/juyu-logo-color.png" alt="聚域"/><img className="logo-dark" src="/brand/juyu-logo-white.png" alt="聚域"/><span>Help Centre</span></Link>;}
const links=[['/admin','内容管理',Files],['/admin?scope=review&view=list','待我审核',Clock],['/admin/media','媒体文件',ImageSquare],['/admin/members','成员与权限',Users],['/admin/analytics','使用分析',ChartBar],['/admin/feedback','文章反馈',ChatCircle],['/admin/availability','归档资料',Archive],['/admin/trash','回收站',Trash]] as const;
export function AdminFrame({children,accountEnabled=false}:{children:ReactNode;accountEnabled?:boolean}){
 const path=usePathname();
 if(path.startsWith('/admin/sign-in'))return <>{children}</>;
 return <InAdminFrame.Provider value={true}><div className="admin-frame"><a className="skip-link" href="#main-content">跳到主要内容</a><header className="app-topbar"><Brand/><span className="app-badge">管理后台</span><form action="/admin" className="app-header-search"><input type="search" name="q" placeholder="搜索文章标题…" aria-label="搜索文章标题"/><button>搜索</button></form><Link prefetch={false} href="/help-centre" className="library-link">员工资料库 <ArrowUpRight size={16}/></Link><AccountMenu admin enabled={accountEnabled}/></header><aside className="admin-sidebar"><details className="admin-mobile-nav"><summary><List size={20}/> 管理导航</summary><Sidebar path={path}/></details><div className="admin-desktop-nav"><Sidebar path={path}/></div><div className="sidebar-bottom"><ThemeToggler/></div></aside><div className="admin-page-content">{children}</div></div></InAdminFrame.Provider>;
}
function Sidebar({path}:{path:string}){return <nav aria-label="后台导航"><Link prefetch={false} href="/admin" className="sidebar-home"><House size={20}/>工作台</Link><div className="sidebar-nav-group">{links.map(([href,label,Icon])=><Link prefetch={false} href={href} key={href} aria-current={href===path?'page':undefined}><Icon size={20}/>{label}</Link>)}</div><details className="settings-nav" open={path.startsWith('/admin/settings')}><summary><Gear size={20}/>设置</summary>{[['features','功能开关'],['navigation','导航设置'],['categories','分类设置'],['fields','自定义字段'],['forms','自定义表单'],['history','设置变更记录']].map(([id,title])=><Link prefetch={false} key={id} href={`/admin/settings/${id}`}>{title}</Link>)}<Link prefetch={false} href="/admin/announcements">公告管理</Link><Link prefetch={false} href="/admin/forms">表单提交记录</Link></details></nav>;}
