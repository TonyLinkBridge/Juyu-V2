'use client';
import type {DefaultSearchDialogProps} from 'fumadocs-ui/components/dialog/search-default';
import {
 SearchDialog,SearchDialogClose,SearchDialogContent,SearchDialogFooter,SearchDialogHeader,
 SearchDialogIcon,SearchDialogInput,SearchDialogList,SearchDialogListItem,SearchDialogOverlay,TagsList,TagsListItem,useSearch,
 type SearchItemType,
} from 'fumadocs-ui/components/dialog/search';
import {useI18n} from 'fumadocs-ui/contexts/i18n';
import {useDocsSearch} from 'fumadocs-core/search/client';
import {fetchClient} from 'fumadocs-core/search/client/fetch';
import {useOnChange} from 'fumadocs-core/utils/use-on-change';
import {useEffect,useMemo,useState,type ComponentProps} from 'react';
import type {SortedResult} from 'fumadocs-core/search';
import {parseSearchScope,searchHref} from '../../reader/search';
import type {FumadocsSearchResult} from '../../fumadocs/search';
import {HighlightQuery} from '../gitbook/Search/HighlightQuery';

class NoStoreSearchCache extends Map<string,SortedResult[]> {
 override get(){return undefined;}
 override set(){return this;}
}

function SearchResultItem({item,...props}:ComponentProps<typeof SearchDialogListItem>){
 const {search}=useSearch();
 const result=item as FumadocsSearchResult;
 return <SearchDialogListItem item={item} {...props}>
  <div className="min-w-0 space-y-1">
   {!!result.breadcrumbs?.length&&<p className="truncate text-xs text-fd-muted-foreground">{result.breadcrumbs.join(' › ')}</p>}
   <p className="font-medium"><HighlightQuery query={search} text={result.title??String(result.content)}/></p>
   {result.snippet&&<p className="line-clamp-2 text-fd-popover-foreground/70"><HighlightQuery query={search} text={result.snippet}/></p>}
  </div>
 </SearchDialogListItem>;
}

/** Fumadocs' default dialog composition with its official tag footer kept inside the modal. */
export function FumadocsScopedSearchDialog({
 defaultTag,tags=[],api,delayMs,allowClear=false,links=[],footer,...props
}:DefaultSearchDialogProps){
 const {locale}=useI18n();
 const [tag,setTag]=useState(defaultTag);
 const [retry,setRetry]=useState(0);
 const [typing,setTyping]=useState(false);
 const cache=useMemo(()=>new NoStoreSearchCache(),[]);
 const client=fetchClient({api,locale,tag,cache});
 const {search,setSearch,query}=useDocsSearch({client,delayMs},[api,locale,tag,retry]);
 const defaultItems=useMemo<SearchItemType[]|null>(()=>links.length?links.map(([name,url])=>({type:'page',id:name,content:name,url})):null,[links]);
 useOnChange(defaultTag,setTag);
 const english=locale==='en';
 const scope=parseSearchScope(typeof tag==='string'?tag:undefined)??'all';
 const pending=Boolean(search.trim())&&(typing||query.isLoading);
 const items=pending||query.error?[]:query.data!=='empty'?query.data:defaultItems;
 useEffect(()=>{
  if(!typing)return;
  const timer=window.setTimeout(()=>setTyping(false),(delayMs??100)+50);
  return ()=>window.clearTimeout(timer);
 },[delayMs,retry,search,tag,typing]);
 const updateSearch=(value:string)=>{setTyping(Boolean(value.trim()));setSearch(value);};
 const updateTag=(value:string|undefined)=>{setTyping(Boolean(search.trim()));setTag(value);};
 const retrySearch=()=>{setTyping(Boolean(search.trim()));setRetry(value=>value+1);};
 const Empty=()=>pending?<div role="status" className="py-12 text-center text-sm text-fd-muted-foreground">{english?'Searching…':'正在搜索…'}</div>:query.error?<div role="alert" className="space-y-3 py-10 text-center text-sm text-fd-muted-foreground">
  <p>{english?'Search could not be loaded. Your text is still here.':'搜索暂时无法读取，你输入的内容仍然保留。'}</p>
  <button type="button" className="rounded-md border px-3 py-1.5 text-fd-foreground" onClick={retrySearch}>{english?'Try again':'重新尝试'}</button>
 </div>:<div className="py-12 text-center text-sm text-fd-muted-foreground">{english?'No results found':'找不到结果'}</div>;
 return <SearchDialog search={search} onSearchChange={updateSearch} isLoading={pending} {...props}>
  <SearchDialogOverlay/>
  <SearchDialogContent>
   <SearchDialogHeader><SearchDialogIcon/><SearchDialogInput/><SearchDialogClose/></SearchDialogHeader>
   <SearchDialogList items={items} Empty={Empty} Item={SearchResultItem}/>
   <SearchDialogFooter>
    <div className="flex flex-wrap items-center justify-between gap-3">
     {tags.length>0&&<TagsList tag={tag} onTagChange={updateTag} allowClear={allowClear}>
      {tags.map(item=><TagsListItem value={item.value} key={item.value}>{item.name}</TagsListItem>)}
     </TagsList>}
     {search.trim()&&<a className="text-sm font-medium text-fd-primary hover:underline" href={searchHref(search,1,scope,english?'en':'zh-CN')}>{english?'View all results':'查看全部结果'}</a>}
    </div>
    {footer}
   </SearchDialogFooter>
  </SearchDialogContent>
 </SearchDialog>;
}
