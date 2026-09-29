'use client';
import {Tabs,TabsContent,TabsList,TabsTrigger} from 'fumadocs-ui/components/tabs';
import type {TextBlock} from '../../../media/model';
import {decodeTabBody} from '../../../media/tab-body';
import {ReaderIcon} from '../../../reader/icons';
import {StructuredDocument} from '../Reading/StructuredDocument';
import {useReaderLocale} from '../../reader-support/ArticleReferenceContext';

type TabsBlock=Extract<TextBlock,{type:'tabs'}>;

/** Admin preview and review surfaces use the same official Fumadocs Tabs
 * primitives as the published reader. JUYU only supplies the stored content. */
export function DynamicTabs({block,documentId,revision,admin=false}:{block:TabsBlock;documentId?:string;revision?:number;admin?:boolean}){
 const locale=useReaderLocale(),english=locale==='en';
 const title=(value:string,index:number)=>value.trim()||(english?`Tab ${index+1}`:`标签 ${index+1}`);
 return <section aria-label={english?'Tabbed content':'分页内容'}><Tabs data-fumadocs-tabs={block.id} defaultValue={block.tabs[0].id}>
  <TabsList aria-label={english?'Content tabs':'内容标签'}>{block.tabs.map((tab,index)=><TabsTrigger key={tab.id} value={tab.id}>{tab.iconKey&&<ReaderIcon icon={tab.iconKey} size={16} className=""/>}{title(tab.title,index)}</TabsTrigger>)}</TabsList>
  {block.tabs.map(tab=>{const body=decodeTabBody(tab.body);return <TabsContent key={tab.id} value={tab.id}>{body?<StructuredDocument blocks={body} documentId={documentId} revision={revision} admin={admin} locale={locale}/>:<p>{tab.body}</p>}</TabsContent>;})}
 </Tabs></section>;
}
