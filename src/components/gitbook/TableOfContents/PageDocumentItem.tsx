// Adapted from GitBook PageDocumentItem.tsx (GPL-3.0), document-only T017 scope.
import type {NavigationPage} from '../../../reader/navigation';
import {ToggleableLinkItem} from './ToggleableLinkItem';

export function PageDocumentItem(props:{page:NavigationPage;currentPagePath:string}) {
 const {page,currentPagePath}=props;
 return <li className="page-document-item flex flex-col [.page-group-item+&]:mt-4">
   <ToggleableLinkItem href={page.href} pathnames={[page.href]} currentPagePath={currentPagePath}>
     <span>{page.title}</span>
   </ToggleableLinkItem>
 </li>;
}
