"use client";
import {usePathname,useSearchParams} from 'next/navigation';
import {HomeLayout} from 'fumadocs-ui/layouts/home';
import {DocsPage} from 'fumadocs-ui/layouts/docs/page';
import {FumadocsDocsLayout} from '../fumadocs/FumadocsDocsLayout';
import {LoadingRegion} from './LoadingSkeletons';
import {LoaderSkeleton} from '../ui/loaders-skeleton';
import '../../app/fumadocs-reader.css';

export function ReaderContentSkeleton({article=false,english=false}:{article?:boolean;english?:boolean}){
 return <LoadingRegion label={english?'Loading knowledge base content…':'正在加载资料库内容…'}><LoaderSkeleton width="72%" height={36}/><LoaderSkeleton className="juyu-skeleton-caption" width="90%" height={14} animated={false}/>{article?<><div className="juyu-skeleton-lines">{[100,96,82,100,92].map((width,index)=><LoaderSkeleton key={index} width={`${width}%`} height={16} animated={index===0}/>)}</div><LoaderSkeleton className="juyu-skeleton-caption" width="40%" height={26} animated={false}/><div className="juyu-skeleton-lines">{[100,92,74].map((width,index)=><LoaderSkeleton key={index} width={`${width}%`} height={16} animated={false}/>)}</div></>:<><LoaderSkeleton height={42} animated={false}/><div className="juyu-reader-loading-cards">{[0,1,2,3].map(index=><div key={index} className="juyu-skeleton-panel"><LoaderSkeleton width="64%" height={20} animated={index===0}/><LoaderSkeleton height={14} animated={false}/><LoaderSkeleton width="80%" height={14} animated={false}/></div>)}</div></>}</LoadingRegion>;
}

/** Public, inert placeholders only; destination pages keep all identity and access checks. */
export default function ReaderRouteLoading(){
 const path=usePathname(),english=useSearchParams().get('lang')==='en';
 const article=path.startsWith('/help-centre/articles/')||path.startsWith('/help-centre/ops/');
 const nav={title:'JUYU Help Centre',url:english?'/help-centre?lang=en':'/help-centre'};
 if(article)return <FumadocsDocsLayout tree={{name:'JUYU Help Centre',children:[]}} nav={nav} tabs={false} searchToggle={{enabled:false}} sidebar={{prefetch:false}}><DocsPage toc={[]} breadcrumb={{enabled:false}}><ReaderContentSkeleton article english={english}/></DocsPage></FumadocsDocsLayout>;
 return <HomeLayout id="main-content" className="juyu-fumadocs" nav={nav} searchToggle={{enabled:false}}><div className="juyu-reader-loading"><ReaderContentSkeleton english={english}/></div></HomeLayout>;
}
