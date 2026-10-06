import type {ReactNode} from 'react';
import {LoaderSkeleton} from '../ui/loaders-skeleton';

export function LoadingRegion({label,children,className=''}:{label:string;children:ReactNode;className?:string}){
 return <div className={`juyu-loading-region ${className}`}><p className="juyu-loading-status" role="status">{label}</p><div role="region" aria-label={label} aria-busy="true"><div aria-hidden="true">{children}</div></div></div>;
}

export function ParagraphSkeleton({label,compact=false}:{label:string;compact?:boolean}){
 return <LoadingRegion label={label}><div className="juyu-skeleton-lines">{[100,94,compact?68:88,...(compact?[]:[100,72])].map((width,index)=><LoaderSkeleton key={index} width={`${width}%`} height={14} animated={index===0}/>)}</div></LoadingRegion>;
}

export function TableSkeleton({rows=4,columns=4}:{rows?:number;columns?:number}){
 return <div className="juyu-skeleton-table">{Array.from({length:rows+1},(_,row)=><div key={row} className="juyu-skeleton-table-row" style={{gridTemplateColumns:`minmax(0,2fr) repeat(${columns-1},minmax(0,1fr))`}}>{Array.from({length:columns},(_,column)=><LoaderSkeleton key={column} width={column===0?'76%':'64%'} height={row===0?12:16} animated={row===1}/>)}</div>)}</div>;
}

export function PeopleTableSkeleton(){return <LoadingRegion label="正在读取员工明细…"><TableSkeleton/></LoadingRegion>;}

function HeadingSkeleton(){return <div className="juyu-skeleton-heading"><LoaderSkeleton width="min(280px,70%)" height={36}/><LoaderSkeleton width="min(430px,90%)" height={14} animated={false}/></div>;}
function ToolbarSkeleton(){return <div className="juyu-skeleton-toolbar"><LoaderSkeleton className="juyu-skeleton-search" height={40}/><LoaderSkeleton width={120} height={40} animated={false}/><LoaderSkeleton width={88} height={40} animated={false}/></div>;}

export function AdminPageSkeleton(){
 return <main id="main-content" className="workspace-loading"><LoadingRegion label="正在加载管理内容…"><HeadingSkeleton/><ToolbarSkeleton/><div className="juyu-skeleton-panel"><TableSkeleton rows={5} columns={5}/></div></LoadingRegion></main>;
}

export function MediaPageSkeleton(){
 return <main id="main-content" className="admin-data-main media-library"><h1>媒体文件</h1><LoadingRegion label="正在加载媒体文件…"><div className="media-library-workspace juyu-media-loading"><div className="media-library-types">{Array.from({length:5},(_,index)=><LoaderSkeleton key={index} height={40} animated={index===0}/>)}</div><div className="media-library-content"><ToolbarSkeleton/><LoaderSkeleton className="juyu-skeleton-caption" width="55%" height={12} animated={false}/><ul className="media-library-grid">{Array.from({length:8},(_,index)=><li key={index}><div className="media-library-tile"><div className="media-library-thumbnail"><LoaderSkeleton height="100%" borderRadius={0} animated={index<2}/></div><LoaderSkeleton width="70%" height={14} animated={false}/><LoaderSkeleton width="48%" height={12} animated={false}/><LoaderSkeleton width="88%" height={12} animated={false}/></div></li>)}</ul></div></div></LoadingRegion></main>;
}

export function AnalyticsPageSkeleton(){
 return <main id="main-content" className="admin-data-main analytics-workspace"><h1>使用分析</h1><LoadingRegion label="正在加载使用分析…"><ToolbarSkeleton/><div className="juyu-skeleton-tabs">{[0,1,2].map(index=><LoaderSkeleton key={index} width={60} height={28} animated={false}/>)}</div><div className="admin-data-metrics">{[0,1,2].map(index=><div className="juyu-skeleton-panel juyu-skeleton-metric" key={index}><LoaderSkeleton width="50%" height={13} animated={false}/><LoaderSkeleton width="65%" height={30}/><LoaderSkeleton width="88%" height={12} animated={false}/></div>)}</div><div className="admin-data-primary"><section className="admin-data-section"><LoaderSkeleton width={150} height={18} animated={false}/><LoaderSkeleton className="juyu-skeleton-chart" height={220}/></section><section className="admin-data-section"><LoaderSkeleton width={100} height={18} animated={false}/><TableSkeleton/></section></div></LoadingRegion></main>;
}

export function EditorLoadingContent(){
 return <div className="juyu-editor-loading"><LoadingRegion label="正在载入编辑器…"><div className="juyu-editor-loading-toolbar"><LoaderSkeleton width={150} height={18} animated={false}/><LoaderSkeleton width={100} height={36} animated={false}/></div><div className="editor-writing"><div className="editor-document-heading"><LoaderSkeleton width={110} height={36} animated={false}/><LoaderSkeleton className="juyu-editor-loading-title" width="75%" height={42}/><LoaderSkeleton height={72} animated={false}/><div className="juyu-skeleton-tabs">{[0,1,2].map(index=><LoaderSkeleton key={index} width={90} height={30} animated={false}/>)}</div><div className="juyu-skeleton-lines">{[100,94,100,78].map((width,index)=><LoaderSkeleton key={index} width={`${width}%`} height={16} animated={index===0}/>)}</div></div></div></LoadingRegion></div>;
}
export function EditorPageSkeleton(){return <main id="main-content" className="editor-main"><EditorLoadingContent/></main>;}
