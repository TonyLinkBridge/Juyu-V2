// Adapted from GitBook TableOfContents.tsx (GPL-3.0).
// Server-authorized pages replace GitBook context/encoder; the sidebar/list/scroll
// structure remains. Mobile dialog wraps the same authorized content; no vendor services.
import {HeaderMobileMenu} from '../Header/HeaderMobileMenu';
import type {NavigationNode} from '../../../reader/tree';
import {ScrollContainer} from './ScrollContainer';
import {PagesList} from './PagesList';

export function TableOfContents(props:{pages:NavigationNode[];currentPagePath:string;failed?:boolean}) {
 const {pages,currentPagePath,failed}=props;
 return <HeaderMobileMenu currentPagePath={currentPagePath}><nav aria-label="文章目录" data-testid="table-of-contents" data-gb-table-of-contents
   className="gitbook-table-of-contents group/table-of-contents text-sm grow-0 shrink-0 flex flex-col min-h-0 gap-4">
   <h2 tabIndex={-1} className="gitbook-toc-heading">文章目录</h2>
   <div className="gitbook-toc-surface relative flex min-h-0 grow flex-col">
     <ScrollContainer activePath={currentPagePath}>
       {failed?<p className="gitbook-toc-empty">暂时无法读取目录</p>:pages.length
         ?<PagesList pages={pages} currentPagePath={currentPagePath} style="grow" isRoot={true}/>
         :<p className="gitbook-toc-empty">暂无可阅读的已发布文章</p>}
     </ScrollContainer>
   </div>
 </nav></HeaderMobileMenu>;
}
