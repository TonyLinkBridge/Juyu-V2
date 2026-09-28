import type {DefaultSearchDialogProps} from 'fumadocs-ui/components/dialog/search-default';
import {englishSearchScopeLabels,parseSearchQuery,parseSearchScope,searchScopeLabels,type SearchQuery,type SearchScope} from '../reader/search.ts';
import type {FumadocsPublicationLocale} from './publication.ts';

const scopes:SearchScope[]=['all','article','ops','reference','qa'];

const scopeDescriptions:Record<FumadocsPublicationLocale,Partial<Record<SearchScope,string>>>={
 'zh-CN':{
  article:'团队正式知识',
  ops:'运营流程与升级处理',
  reference:'业务规则速查',
  qa:'已审核标准答案',
 },
 en:{
  article:'Approved team knowledge',
  ops:'Operations and escalation guidance',
  reference:'Business rules and quick reference',
  qa:'Reviewed standard answers',
 },
};

export function fumadocsSearchScopeDescription(locale:FumadocsPublicationLocale,scope:SearchScope):string|undefined {
 return scopeDescriptions[locale][scope];
}

export function fumadocsSearchOptions(locale:FumadocsPublicationLocale):Partial<DefaultSearchDialogProps> {
 const labels=locale==='en'?englishSearchScopeLabels:searchScopeLabels;
 return {
  api:'/api/fumadocs-search',
  defaultTag:'all',
  tags:scopes.map(value=>({value,name:labels[value]})),
 };
}

export interface FumadocsSearchRequest extends SearchQuery {
 locale:FumadocsPublicationLocale;
 scope:SearchScope;
}

export function parseFumadocsSearchRequest(url:URL):FumadocsSearchRequest {
 const keys=[...url.searchParams.keys()];
 if(
  keys.some(key=>!['query','locale','tag'].includes(key))
  ||url.searchParams.getAll('query').length!==1
  ||url.searchParams.getAll('locale').length>1
  ||url.searchParams.getAll('tag').length>1
 )throw new Error('INVALID_INPUT');
 const parsed=parseSearchQuery(url.searchParams.get('query')??undefined);
 const rawLocale=url.searchParams.get('locale');
 const locale=rawLocale===null||rawLocale==='zh-CN'?'zh-CN':rawLocale==='en'?'en':null;
 const scope=parseSearchScope(url.searchParams.get('tag')??undefined);
 if(!locale||!scope||parsed.status==='invalid')throw new Error('INVALID_INPUT');
 return {...parsed,locale,scope};
}
