import {categoryPage,type CategoryPage} from './category-page.ts';
import type {NavigationNode} from './tree.ts';
import type {NavigationPage} from './navigation.ts';
export type DirectoryKind='ops'|'reference';
export interface SectionQuery {page:number;category?:string;q:string;locale:'zh-CN'|'en'}
export interface SectionPage {category?:CategoryPage;groups:NavigationNode[];items:NavigationPage[];total:number;page:number;pages:number;query:SectionQuery}
export function sectionQuery(input:Record<string,string|string[]|undefined>):SectionQuery{
 for(const [key,value] of Object.entries(input))if(!['page','category','q','lang'].includes(key)||typeof value!=='string')throw new Error('INVALID_INPUT');
 const page=input.page??'1',category=input.category,q=(input.q??'') as string,lang=input.lang;
 if(!/^[1-9]\d{0,5}$/.test(page as string)||category!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(category as string)||[...q].length>120||/[\u0000-\u001f\u007f-\u009f]/.test(q)||lang!==undefined&&!['en','zh-CN'].includes(lang as string))throw new Error('INVALID_INPUT');
 return {page:Number(page),...(category?{category:category as string}:{}),q:q.trim(),locale:lang==='en'?'en':'zh-CN'};
}
export function sectionHref(kind:DirectoryKind,query:SectionQuery){
 const p=new URLSearchParams();if(query.category)p.set('category',query.category);if(query.q)p.set('q',query.q);if(query.locale==='en')p.set('lang','en');if(query.page>1)p.set('page',String(query.page));
 return `/help-centre/${kind}`+(p.size?'?'+p:'');
}
export function sectionPage(tree:NavigationNode[],query:SectionQuery):SectionPage|null{
 const category=query.category?categoryPage(tree,query.category):undefined;if(query.category&&!category)return null;
 const nodes:NavigationNode[]=category?findGroup(tree,category.id)!.descendants:tree;
 const items:NavigationPage[]=[],seen=new Set<string>();
 const collect=(nodes:NavigationNode[])=>{for(const node of nodes)if(node.type==='group')collect(node.descendants);else if(!seen.has(node.id)){seen.add(node.id);items.push(node);}};collect(nodes);
 const words=query.q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const filtered=items.filter(item=>words.every(word=>(item.title+' '+(item.description??'')).toLocaleLowerCase().includes(word)));
 const pages=Math.max(1,Math.ceil(filtered.length/20)),page=Math.min(query.page,pages);
 return {category:category??undefined,groups:nodes.filter(node=>node.type==='group'),items:filtered.slice((page-1)*20,page*20),total:filtered.length,page,pages,query};
}
function findGroup(nodes:NavigationNode[],id:string):Extract<NavigationNode,{type:'group'}>|undefined{for(const node of nodes)if(node.type==='group'){if(node.id===id)return node;const child=findGroup(node.descendants,id);if(child)return child;}}
