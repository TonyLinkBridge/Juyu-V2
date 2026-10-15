import type {NavigationNode, NavigationGroup} from './tree.ts';
import type {ReaderIconKey} from './icon-keys.ts';
import type {NavigationPage} from './navigation.ts';
export interface CategoryPage { id:string; title:string; ancestors:{id:string;title:string}[]; items:NavigationPage[]; groups:NavigationGroup[]; iconKey?:ReaderIconKey|null; total:number; page:number; pages:number }
/** Input is the existing server-authorized publication tree, never the editable shortcut configuration. */
export function categoryPage(tree:NavigationNode[],id:string,page=1):CategoryPage|null {
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)||!Number.isSafeInteger(page)||page<1||page>=2147483647)throw new Error('INVALID_INPUT');
 const queue:{node:NavigationNode;ancestors:{id:string;title:string}[]}[]=tree.map(node=>({node,ancestors:[]}));
 let selected:{node:NavigationGroup;ancestors:{id:string;title:string}[]}|undefined;
 while(queue.length){const item=queue.shift()!;if(item.node.type!=='group')continue;if(item.node.id===id){selected={node:item.node,ancestors:item.ancestors};break;}queue.push(...item.node.descendants.map(node=>({node,ancestors:[...item.ancestors,{id:item.node.id,title:item.node.title}]})));}
 if(!selected)return null;
 const items:NavigationPage[]=[],seen=new Set<string>();
 const flatten=(nodes:NavigationNode[])=>{for(const node of nodes){if(node.type==='group')flatten(node.descendants);else if(!seen.has(node.id)){seen.add(node.id);items.push({...node});}}};
 flatten(selected.node.descendants);
 if(!items.length)return null;
 const pages=Math.ceil(items.length/20),current=Math.min(page,pages);
 return {id,title:selected.node.title,iconKey:selected.node.iconKey,groups:selected.node.descendants.filter((node):node is NavigationGroup=>node.type==='group'),ancestors:selected.ancestors,items:items.slice((current-1)*20,current*20),total:items.length,page:current,pages};
}

/** Only accepts the already-authorized tree; titles and article URLs stay unchanged. */
export function categoryCards(tree:NavigationNode[],locale:'zh-CN'|'en'='zh-CN'){
 return tree.flatMap(node=>{
  if(node.type!=='group')return [];
  const data=categoryPage([node],node.id);
  if(!data)return [];
  return [{id:node.id,title:node.title,iconKey:node.iconKey,href:categoryHref(node.id,locale),topics:data.groups.map(group=>group.title),articles:data.items.slice(0,4).map(item=>item.title)}];
 });
}
export function categoryHref(id:string,locale:'zh-CN'|'en'='zh-CN',page=1){
 const query=new URLSearchParams();
 if(locale==='en')query.set('lang','en');
 if(page>1)query.set('page',String(page));
 return `/help-centre/categories/${encodeURIComponent(id)}${query.size?'?'+query.toString():''}`;
}
