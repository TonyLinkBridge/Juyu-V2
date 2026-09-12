// Adapted from GitBook TableOfContents.tsx (GPL-3.0).
// Server-authorized pages replace GitBook context/encoder; the sidebar/list/scroll
// structure remains. Mobile dialog wraps the same authorized content; no vendor services.
import Link from 'next/link';
import {House} from '@phosphor-icons/react/dist/ssr';
import {HeaderMobileMenu} from '../Header/HeaderMobileMenu';
import type {NavigationNode} from '../../../reader/tree';
import {ScrollContainer} from './ScrollContainer';
import {PagesList} from './PagesList';

export function TableOfContents(props:{section?:'ops';pages:NavigationNode[];currentPagePath:string;failed?:boolean}) {
 const {pages,currentPagePath,failed,section}=props;
 return <HeaderMobileMenu title={section==='ops'?'OPS Internal · 文章目录':undefined} currentPagePath={currentPagePath}><nav aria-label="文章目录" data-testid="table-of-contents" data-gb-table-of-contents
   className="gitbook-table-of-contents group/table-of-contents text-sm grow-0 shrink-0 flex flex-col min-h-0 gap-4">
   <Link className="toc-home-link" href="/help-centre" prefetch={false}><House size={20} aria-hidden="true"/><span>{section==='ops'?'返回帮助中心':'帮助中心'}</span></Link>
   <h2 tabIndex={-1} className="gitbook-toc-heading">{section==='ops'?'OPS Internal · 文章目录':'文章目录'}</h2>
   <div className="gitbook-toc-surface relative flex min-h-0 grow flex-col">
     <ScrollContainer activePath={currentPagePath}>
       {failed?<p className="gitbook-toc-empty">暂时无法读取目录</p>:pages.length
         ?<PagesList pages={pages} currentPagePath={currentPagePath} style="grow" isRoot={true}/>
         :<p className="gitbook-toc-empty">暂无可阅读的已发布文章</p>}
     </ScrollContainer>
   </div>
 </nav></HeaderMobileMenu>;
}
