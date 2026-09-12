import {requireFeature} from '../features/repository.ts';
import type {PoolClient} from 'pg';
import {parseSearchQuery,searchSnippet,searchResultHref,type TitleSearch,type SearchResult} from '../../reader/search.ts';
import type {NavigationNode} from '../../reader/tree.ts';
import type {ContentKind} from '../../domain/model.ts';

/** Search executes inside the same repeatable-read authorization scope as the tree. */
export async function searchPublications(client:PoolClient,nodes:NavigationNode[],raw:string|string[]|undefined,rawPage?:string|string[]):Promise<TitleSearch>{await requireFeature(client,'search');
 const parsed=parseSearchQuery(raw);
 const validPage=rawPage===undefined||(typeof rawPage==='string'&&/^[1-9][0-9]{0,5}$/.test(rawPage));
 const page=validPage?Number(rawPage??1):1;
 const state:TitleSearch={...parsed,status:validPage?parsed.status:'invalid',results:[],total:0,page,pages:0};
 if(state.status!=='ready')return state;
 const paths=new Map<string,{href:string;breadcrumbs:string[]}>();
 const stack=nodes.map(node=>({node,breadcrumbs:[] as string[]})).reverse();
 while(stack.length){
  const {node,breadcrumbs}=stack.pop()!;
  if(node.type==='group')for(let i=node.descendants.length-1;i>=0;i--)stack.push({node:node.descendants[i],breadcrumbs:[...breadcrumbs,node.title]});
  else if(!paths.has(node.id))paths.set(node.id,{href:node.href,breadcrumbs});
 }
 const {rows}=await client.query<{id:string|null;title:string;kind:ContentKind;revision:number;tags:string[];search_text:string;total:string}>(
  'SELECT * FROM juyu.search_publications($1::text[],$2::integer)',[parsed.query.split(' '),page]);
 const total=Number(rows[0]?.total??0);
 const results:SearchResult[]=rows.filter(row=>row.id!==null).map(row=>{
  const path=paths.get(row.id!);
  // A projection/tree inconsistency is an unavailable result, never a leaked item
  // or a fabricated zero count. Both are read in the same authorized snapshot.
  if(!path)throw new Error('SEARCH_UNAVAILABLE');
  return {id:row.id!,title:row.title,...path,href:searchResultHref(row.kind,row.id!,path.href),kind:row.kind,revision:row.revision,tags:row.tags,snippet:searchSnippet(row.search_text,parsed.query)};
 });
 return {...state,total,pages:Math.ceil(total/20),results};
}
