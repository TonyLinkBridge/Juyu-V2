import {navigationPage,type NavigationPage} from './navigation.ts';
export type NavigationNode=(NavigationPage&{type:'document'})|NavigationGroup;
export interface NavigationGroup {type:'group';id:string;title:string;descendants:NavigationNode[]}
export interface NavigationCategory {id:string;name:string;parent_id:string|null;position:number}
export interface NavigationMembership {document_id:string;category_id:string}
const compareText=(a:string,b:string)=>a<b?-1:a>b?1:0;

/** Input must already be authorized. Never promote invalid category paths to root. */
export function buildNavigationTree(pages:{id:string;title:string}[],categories:NavigationCategory[],memberships:NavigationMembership[],options:{repeatMemberships?:boolean}={}):NavigationNode[] {
 const children=new Map<string|null,NavigationCategory[]>();
 for(const category of categories) {
   const siblings=children.get(category.parent_id)??[];siblings.push(category);children.set(category.parent_id,siblings);
 }
 for(const siblings of children.values())siblings.sort((a,b)=>a.position-b.position||compareText(a.id,b.id));
 const ordered:NavigationCategory[]=[];const visited=new Set<string>();
 const stack=[...(children.get(null)??[])].reverse();
 while(stack.length) {
   const category=stack.pop()!;if(visited.has(category.id))continue;
   visited.add(category.id);ordered.push(category);
   stack.push(...[...(children.get(category.id)??[])].reverse());
 }
 const rank=new Map(ordered.map((category,index)=>[category.id,index]));
 const nodes=new Map<string,NavigationGroup>(ordered.map(category=>[category.id,{type:'group',id:category.id,title:category.name,descendants:[]} ]));
 const roots:NavigationNode[]=[];
 for(const category of ordered) {
   const node=nodes.get(category.id)!;
   if(category.parent_id===null)roots.push(node);else nodes.get(category.parent_id)!.descendants.push(node);
 }
 const memberCategories=new Map<string,Set<string>>();
 for(const membership of memberships) {
   const ids=memberCategories.get(membership.document_id)??new Set<string>();ids.add(membership.category_id);memberCategories.set(membership.document_id,ids);
 }
 const seenPages=new Set<string>();
 for(const page of [...pages].sort((a,b)=>compareText(a.title,b.title)||compareText(a.id,b.id))) {
   if(seenPages.has(page.id))continue;seenPages.add(page.id);
   const ids=[...(memberCategories.get(page.id)??[])];
   // A missing/invalid membership invalidates the entire page, even if another is valid.
   if(ids.some(id=>!rank.has(id)))continue;
   const target=ids.sort((a,b)=>rank.get(a)!-rank.get(b)!)[0];
   const node:NavigationNode={type:'document',...navigationPage(page)};
   if(target===undefined)roots.push(node);
   else for(const id of options.repeatMemberships?ids:[target])nodes.get(id)!.descendants.push({...node});
 }
 // Bottom-up pruning keeps empty and restricted category names out of the payload.
 const nonempty=(node:NavigationNode)=>node.type==='document'||node.descendants.length>0;
 for(const category of [...ordered].reverse()) {
   const node=nodes.get(category.id)!;node.descendants=node.descendants.filter(nonempty);
 }
 return roots.filter(nonempty);
}

export function selectTreePage(nodes:NavigationNode[],requested:string|string[]|undefined):NavigationPage|null {
 if(typeof requested!=='string')return null;
 const stack=[...nodes];
 while(stack.length) {
   const node=stack.pop()!;
   if(node.type==='group')stack.push(...node.descendants);
   else if(node.id===requested)return node;
 }
 return null;
}
