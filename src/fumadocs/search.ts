import type {SortedResult} from 'fumadocs-core/search';
import type {TitleSearch} from '../reader/search.ts';
import {formalFumadocsPublicationPath} from './publication.ts';

function resultUrl(item:TitleSearch['results'][number]):string {
 return !item.kind||item.kind==='article'||item.kind==='ops'?formalFumadocsPublicationPath(item.id):item.href;
}

/** Converts an already authorized JUYU search result into Fumadocs' official search result contract. */
export function fumadocsSearchResults(search:TitleSearch):SortedResult[] {
 if(search.status!=='ready')return [];
 return search.results.flatMap(item=>{
  const url=resultUrl(item);
  const page:SortedResult={id:item.id,type:'page',url,content:item.title,...(item.breadcrumbs.length?{breadcrumbs:item.breadcrumbs}:{})};
  if(!item.snippet)return [page];
  return [page,{id:`${item.id}:snippet`,type:'text',url,content:item.snippet,breadcrumbs:[...item.breadcrumbs,item.title]}];
 });
}
