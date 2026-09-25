'use client';
import type {DefaultSearchDialogProps} from 'fumadocs-ui/components/dialog/search-default';
import {
 SearchDialog,SearchDialogClose,SearchDialogContent,SearchDialogFooter,SearchDialogHeader,
 SearchDialogIcon,SearchDialogInput,SearchDialogList,SearchDialogOverlay,TagsList,TagsListItem,
 type SearchItemType,
} from 'fumadocs-ui/components/dialog/search';
import {useI18n} from 'fumadocs-ui/contexts/i18n';
import {useDocsSearch} from 'fumadocs-core/search/client';
import {fetchClient} from 'fumadocs-core/search/client/fetch';
import {useOnChange} from 'fumadocs-core/utils/use-on-change';
import {useMemo,useState} from 'react';

/** Fumadocs' default dialog composition with its official tag footer kept inside the modal. */
export function FumadocsScopedSearchDialog({
 defaultTag,tags=[],api,delayMs,allowClear=false,links=[],footer,...props
}:DefaultSearchDialogProps){
 const {locale}=useI18n();
 const [tag,setTag]=useState(defaultTag);
 const client=fetchClient({api,locale,tag});
 const {search,setSearch,query}=useDocsSearch({client,delayMs});
 const defaultItems=useMemo<SearchItemType[]|null>(()=>links.length?links.map(([name,url])=>({type:'page',id:name,content:name,url})):null,[links]);
 useOnChange(defaultTag,setTag);
 return <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
  <SearchDialogOverlay/>
  <SearchDialogContent>
   <SearchDialogHeader><SearchDialogIcon/><SearchDialogInput/><SearchDialogClose/></SearchDialogHeader>
   <SearchDialogList items={query.data!=='empty'?query.data:defaultItems}/>
   <SearchDialogFooter>
    {tags.length>0&&<TagsList tag={tag} onTagChange={setTag} allowClear={allowClear}>
     {tags.map(item=><TagsListItem value={item.value} key={item.value}>{item.name}</TagsListItem>)}
    </TagsList>}
    {footer}
   </SearchDialogFooter>
  </SearchDialogContent>
 </SearchDialog>;
}
