import {parseSearchQuery,parseSearchScope,type SearchScope} from './search.ts';

const KEY='juyu-recent-search-v1';
const storageKey=(locale:'zh-CN'|'en')=>locale==='en'?KEY+':en':KEY;
const MAX=5,TTL=30*60*1000;
export type RecentSearch={query:string;scope:SearchScope;at:number};
export function recentSearches(storage:Pick<Storage,'getItem'>,now=Date.now(),locale:'zh-CN'|'en'='zh-CN'):RecentSearch[]{
 try{
  const raw=JSON.parse(storage.getItem(storageKey(locale))??'[]') as unknown;
  if(!Array.isArray(raw))return [];
  return raw.filter((entry):entry is RecentSearch=>Boolean(entry&&typeof entry==='object'&&typeof entry.query==='string'&&parseSearchQuery(entry.query).status==='ready'&&parseSearchScope(entry.scope)===entry.scope&&Number.isFinite(entry.at)&&entry.at<=now&&now-entry.at<TTL)).slice(0,MAX).map(entry=>({query:parseSearchQuery(entry.query).query,scope:entry.scope,at:entry.at}));
 }catch{return [];}
}
export function recordRecentSearch(storage:Pick<Storage,'getItem'|'setItem'>,query:string,scope:SearchScope,now=Date.now(),locale:'zh-CN'|'en'='zh-CN'):RecentSearch[]{
 const parsed=parseSearchQuery(query);if(parsed.status!=='ready')return recentSearches(storage,now,locale);
 const next=[{query:parsed.query,scope,at:now},...recentSearches(storage,now,locale).filter(entry=>!(entry.query===parsed.query&&entry.scope===scope))].slice(0,MAX);
 try{storage.setItem(storageKey(locale),JSON.stringify(next));}catch{}
 return next;
}
export function clearRecentSearch(storage:Pick<Storage,'removeItem'>,locale:'zh-CN'|'en'='zh-CN'){try{storage.removeItem(storageKey(locale));}catch{}}
