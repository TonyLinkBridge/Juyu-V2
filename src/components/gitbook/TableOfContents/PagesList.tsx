// Adapted from GitBook PagesList.tsx (GPL-3.0). T018 adds its group branch.
import type {NavigationNode} from '../../../reader/tree';
import {PageDocumentItem} from './PageDocumentItem';
import {PageGroupItem} from './PageGroupItem';

export function PagesList(props:{pages:NavigationNode[];currentPagePath:string;style?:string;isRoot?:boolean}) {
 const {pages,style,currentPagePath,isRoot=false}=props;
 return <ul className={['gitbook-pages-list flex flex-col gap-y-0.5',style].filter(Boolean).join(' ')}>
   {pages.map((page,index)=>{
     switch(page.type) {
       case 'document':return <PageDocumentItem key={`document:${page.id}`} page={page} currentPagePath={currentPagePath}/>;
       case 'group':return <PageGroupItem key={`group:${page.id}:${currentPagePath}`} page={page} currentPagePath={currentPagePath} isFirst={isRoot&&index===0}/>;
     }
   })}
 </ul>;
}
