import type {SortedResult} from 'fumadocs-core/search';
import {englishSearchScopeLabels,searchScopeLabels,type TitleSearch} from '../reader/search.ts';
import type {ContentKind} from '../domain/model.ts';
import {formalFumadocsPublicationPath} from './publication.ts';

function resultUrl(item:TitleSearch['results'][number]):string {
 return !item.kind||item.kind==='article'||item.kind==='ops'?formalFumadocsPublicationPath(item.id):item.href;
}

/** Converts an already authorized JUYU search result into Fumadocs' official search result contract. */
export type FumadocsSearchResult=SortedResult&{
 title:string;
 snippet?:string;
 kind:ContentKind;
 revision?:number;
 total:number;
};

export function fumadocsSearchResults(search:TitleSearch,locale:'zh-CN'|'en'='zh-CN'):FumadocsSearchResult[] {
 if(search.status!=='ready')return [];
 const labels=locale==='en'?englishSearchScopeLabels:searchScopeLabels;
 return search.results.map(item=>{
  const url=resultUrl(item);
  const kind=item.kind??'article';
  return {id:item.id,type:'page',url,content:item.title,breadcrumbs:[labels[kind],...item.breadcrumbs],title:item.title,snippet:item.snippet,kind,revision:item.revision,total:search.total};
 });
}
