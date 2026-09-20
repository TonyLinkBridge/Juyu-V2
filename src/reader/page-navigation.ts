import type {NavigationPage} from './navigation.ts';
import {firstTreePage,type NavigationNode} from './tree.ts';
export interface BreadcrumbSibling {id:string;title:string;href:string}
export interface PageNavigation {current:NavigationPage;ancestors:{id:string;title:string;siblings?:BreadcrumbSibling[]}[];previous:NavigationPage|null;next:NavigationPage|null}
/** Adapted from GitBook lib/pages resolvePrevNextPages: flatten -> index -> neighbours.
 * Input is the server-authorized formal tree, never a complete management catalogue.
 * JUYU adds ancestor paths and document deduplication; this helper is not authorization.
 */
export function pageNavigation(nodes:NavigationNode[],requested:string|string[]|undefined):PageNavigation|null {
 if(typeof requested!=='string')return null;
 const flat:{page:NavigationPage;ancestors:PageNavigation['ancestors']}[]=[];
 const stack=nodes.map(node=>({node,ancestors:[] as PageNavigation['ancestors']})).reverse();
 const seen=new Set<string>();
 while(stack.length){
   const {node,ancestors}=stack.pop()!;
   if(node.type==='group'){
     const chain=[...ancestors,{id:node.id,title:node.title}];
     for(let i=node.descendants.length-1;i>=0;i--)stack.push({node:node.descendants[i],ancestors:chain});
   }else if(!seen.has(node.id)){
     seen.add(node.id);flat.push({page:node,ancestors});
   }
 }
 const currentIndex=flat.findIndex(item=>item.page.id===requested);
 if(currentIndex===-1)return null;
 let level=nodes;
 const ancestors=flat[currentIndex].ancestors.map(ancestor=>{
   const siblings=level.filter((node):node is Extract<NavigationNode,{type:'group'}>=>node.type==='group').map(group=>({id:group.id,title:group.title,href:firstTreePage(group.descendants)?.href??''})).filter(group=>group.href);
   const group=level.find(node=>node.type==='group'&&node.id===ancestor.id);
   level=group?.type==='group'?group.descendants:[];
   return siblings.length>1?{...ancestor,siblings}:ancestor;
 });
 return {current:flat[currentIndex].page,ancestors,previous:flat[currentIndex-1]?.page??null,next:flat[currentIndex+1]?.page??null};
}
