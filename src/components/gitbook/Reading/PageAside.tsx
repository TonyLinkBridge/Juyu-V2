// Adapted from GitBook PageAside/PageAside.tsx (GPL-3.0).
// Retain aside/outline/header/sections; responsive details replaces SideSheet.
import type {DocumentSection} from '../../../reader/body';
import {ScrollSectionsList} from './ScrollSectionsList';
export function PageAside({sections}:{sections:DocumentSection[]}) {
 if(!sections.length)return null;
 return <aside className="gitbook-page-aside group/aside">
   <details open className="outline-disclosure"><summary>本页目录</summary>
     <nav aria-label="本页目录" data-gb-page-outline className="overflow-y-auto">
       <ScrollSectionsList sections={sections}/>
     </nav>
   </details>
 </aside>;
}
