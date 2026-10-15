import {FullSearchTrigger} from 'fumadocs-ui/layouts/shared/slots/search-trigger';
import {NavigationLink as Link} from '../shell/NavigationLink';
import type {MenuItem} from '../../navigation-settings/model';

export function KnowledgeHomeHero({menu,search=true,locale='zh-CN',directory=false,title}:{menu:MenuItem[];search?:boolean;locale?:'zh-CN'|'en';directory?:boolean;title?:string}){
 const english=locale==='en';
 const entries=menu.filter(item=>!['/help-centre/favorites','/help-centre/recent','/help-centre/forms'].includes(item.href));
 const href=(value:string)=>value==='/help-centre'?(english?'/help-centre/library?lang=en':'/help-centre/library'):english&&['/help-centre/ops','/help-centre/reference','/help-centre/qa'].includes(value)?`${value}?lang=en`:value;
 const label=(item:MenuItem)=>english?item.href==='/help-centre'?'Articles':item.href.includes('ops')?'OPS Internal':item.href.includes('reference')?'Reference':item.href.includes('qa')?'Q&A':item.label:item.href==='/help-centre'?'知识文章':item.label;
 return <section className="home-hero">
  <p className="home-eyebrow">{english?'JUYU team knowledge and operations':'JUYU 内部知识与运营中心'}</p>
  <h1>{title??(directory?(english?<>Find the <span>answer</span> by topic</>:<>按业务，找到你需要的<span>答案</span></>):(english?<>What answer do you need <span>today?</span></>:<>今天需要找什么<span>答案</span>？</>))}</h1>
  <p className="home-description">{directory?(title?(english?'Browse the approved articles in this topic.':'查阅本分类下的正式资料与操作说明。'):(english?'Choose a topic, then find the approved guidance for your work.':'先选择业务分类，再查阅对应的流程、规则与操作说明。')):(english?'Find clear, approved guidance for the work in front of you.':'从正式知识与业务速查中，找到可靠的处理依据。')}</p>
  {search&&<div className="home-search"><FullSearchTrigger hideIfDisabled/></div>}
  <nav className="home-section-nav" aria-label={english?'Content types':'资料类型'}>
   <div className="home-section-tabs">{entries.map(item=><Link prefetch={false} prefetchOnIntent key={item.id} href={href(item.href)} aria-current={item.href==='/help-centre'?'page':undefined}>{label(item)}</Link>)}</div>
   {!directory&&<p>{english?'Quick access to the knowledge and answers you need':'快速获取你需要的知识与答案'}</p>}
  </nav>
 </section>;
}
