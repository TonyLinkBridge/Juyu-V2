import {navigationPage,type NavigationPage} from './navigation.ts';
import type {NavigationNode} from './tree.ts';
export interface PageNavigation {current:NavigationPage;ancestors:{id:string;title:string}[];previous:NavigationPage|null;next:NavigationPage|null}
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
     seen.add(node.id);flat.push({page:navigationPage(node),ancestors});
   }
 }
 const currentIndex=flat.findIndex(item=>item.page.id===requested);
 if(currentIndex===-1)return null;
 return {current:flat[currentIndex].page,ancestors:flat[currentIndex].ancestors,previous:flat[currentIndex-1]?.page??null,next:flat[currentIndex+1]?.page??null};
}
