import type {NavigationNode, NavigationGroup} from './tree.ts';
import type {NavigationPage} from './navigation.ts';
export interface CategoryPage { id:string; title:string; ancestors:{id:string;title:string}[]; items:NavigationPage[]; total:number; page:number; pages:number }
/** Input is the existing server-authorized publication tree, never the editable shortcut configuration. */
export function categoryPage(tree:NavigationNode[],id:string,page=1):CategoryPage|null {
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)||!Number.isSafeInteger(page)||page<1||page>=2147483647)throw new Error('INVALID_INPUT');
 const queue:{node:NavigationNode;ancestors:{id:string;title:string}[]}[]=tree.map(node=>({node,ancestors:[]}));
 let selected:{node:NavigationGroup;ancestors:{id:string;title:string}[]}|undefined;
 while(queue.length){const item=queue.shift()!;if(item.node.type!=='group')continue;if(item.node.id===id){selected={node:item.node,ancestors:item.ancestors};break;}queue.push(...item.node.descendants.map(node=>({node,ancestors:[...item.ancestors,{id:item.node.id,title:item.node.title}]})));}
 if(!selected)return null;
 const items:NavigationPage[]=[],seen=new Set<string>();
 const flatten=(nodes:NavigationNode[])=>{for(const node of nodes){if(node.type==='group')flatten(node.descendants);else if(!seen.has(node.id)){seen.add(node.id);items.push({id:node.id,title:node.title,href:node.href});}}};
 flatten(selected.node.descendants);
 if(!items.length)return null;
 const pages=Math.ceil(items.length/20),current=Math.min(page,pages);
 return {id,title:selected.node.title,ancestors:selected.ancestors,items:items.slice((current-1)*20,current*20),total:items.length,page:current,pages};
}
