import type {NavigationNode} from '../../reader/tree';
import type {MenuItem} from '../../navigation-settings/model';
import type {RecentItem} from '../../recent/model';
import {KnowledgeDirectory} from './KnowledgeDirectory';
import {KnowledgeHomeActivity} from './KnowledgeHomeActivity';

export function KnowledgeHome({pages,menu,latest,recent,search=true,showRecent=true,locale='zh-CN'}:{
 pages:NavigationNode[];
 menu:MenuItem[];
 latest:{id:string;title:string;updated:string}[];
 recent:RecentItem[];
 search?:boolean;
 showRecent?:boolean;
 admin?:boolean;
 locale?:'zh-CN'|'en';
}){
 return <KnowledgeDirectory pages={pages} menu={menu} search={search} locale={locale} home>
  <KnowledgeHomeActivity latest={latest} recent={recent} showRecent={showRecent} locale={locale}/>
 </KnowledgeDirectory>;
}
