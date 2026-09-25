import {articleContentPath,contentPath} from '../../reader/content-path';
import {NavigationLink as Link} from '../shell/NavigationLink';
import {ArrowRight} from '@phosphor-icons/react/dist/ssr';
import type {NavigationNode} from '../../reader/tree';
import type {MenuItem} from '../../navigation-settings/model';
import type {RecentItem} from '../../recent/model';
import {FullSearchTrigger} from 'fumadocs-ui/layouts/shared/slots/search-trigger';

export function KnowledgeHome({
  pages,
  menu,
  latest,
  recent,
  search=true,
  showRecent=true,
  admin=false,
  locale='zh-CN'
}:{
  pages:NavigationNode[];
  menu:MenuItem[];
  latest:{id:string;title:string;updated:string}[];
  recent:RecentItem[];
  search?:boolean;
  showRecent?:boolean;
  admin?:boolean;
  locale?:'zh-CN'|'en';
}){
  const english=locale==='en';
  const documents:Extract<NavigationNode,{type:'document'}>[]=[];

  function collect(nodes:NavigationNode[]){
    for(const n of nodes){
      if(n.type==='group'){
        collect(n.descendants);
      }else if(!documents.some(d=>d.id===n.id)){
        documents.push(n);
      }
    }
  }

  collect(pages);

  const entries=menu.filter(
    item=>![
      '/help-centre/favorites',
      '/help-centre/recent',
      '/help-centre/forms'
    ].includes(item.href)
  );
  const featured=documents[0];
  const remaining=documents.slice(1,4);
  const entryHref=(href:string)=>href==='/help-centre'
    ? english?'/help-centre/library?lang=en':'/help-centre/library'
    : english&&['/help-centre/ops','/help-centre/reference','/help-centre/qa'].includes(href)
      ? `${href}?lang=en`
      : href;
  const entryLabel=(item:MenuItem)=>english
    ? item.href==='/help-centre'?'Articles':item.href.includes('ops')?'OPS Internal':item.href.includes('reference')?'Reference':item.href.includes('qa')?'Q&A':item.label
    : item.href==='/help-centre'?'知识文章':item.label;

  return (
    <div className="knowledge-home knowledge-home--editorial">
      <section className="home-hero">
        <p className="home-eyebrow">
          {english?'JUYU team knowledge and operations':'JUYU 内部知识与运营中心'}
        </p>

        <h1>{english?<>What answer do you need <span>today?</span></>:<>今天需要找什么<span>答案</span>？</>}</h1>

        <p className="home-description">
          {english?'Find clear, approved guidance for the work in front of you.':'从正式知识与业务速查中，找到可靠的处理依据。'}
        </p>

        {search&&(
          <div className="home-search">
            <FullSearchTrigger hideIfDisabled/>
          </div>
        )}

        <nav className="home-section-nav" aria-label={english?'Content types':'资料类型'}>
          <div className="home-section-tabs">
            {entries.map(item=><Link
              prefetch={false}
              prefetchOnIntent
              key={item.id}
              href={entryHref(item.href)}
              aria-current={item.href==='/help-centre'?'page':undefined}
            >{entryLabel(item)}</Link>)}
          </div>
          <p>{english?'Quick access to the knowledge and answers you need':'快速获取你需要的知识与答案'}</p>
        </nav>
      </section>

      <div className="home-content">
        <div className="home-columns">
          <div className="home-primary">
            <section className="home-featured-section">
              <div className="home-section-heading">
                <h2>{english?'Featured':'重点资料'}</h2>
                <span>{english?'Start with the core guidance':'从核心资料开始，快速了解流程与操作规范'}</span>
                {featured&&<Link prefetch={false} prefetchOnIntent href={featured.href}>{english?'Read article':'阅读全文'} <ArrowRight size={16}/></Link>}
              </div>

              {featured&&<Link className="home-featured" prefetch={false} prefetchOnIntent href={featured.href}>
                <span className="home-featured-kicker">{english?'ARTICLE':'知识文章'}</span>
                <h3>{featured.title}</h3>
                <small>{english?'Published · Team knowledge':'已发布 · 正式资料'}</small>
                <p>{featured.description??(english?'Open this approved guide for the current process and operating rules.':'查看这份已审核资料，快速了解相关规则和处理步骤。')}</p>
                <span className="home-featured-number" aria-hidden="true">01</span>
                <span className="home-featured-mark" aria-hidden="true">JUYU<br/>KNOWLEDGE</span>
              </Link>}
            </section>

            <section id="knowledge-documents" className="home-library-section">
              <div className="home-section-heading">
                <h2>{english?'Articles':'知识资料'}</h2>
                <span>{english?'Approved guidance for your team':'按业务查阅团队的正式文档'}</span>
              </div>

              <ul className="home-document-list">
                {remaining.map((d,index)=><li key={d.id}>
                  <Link prefetch={false} prefetchOnIntent href={d.href}>
                    <span className="home-document-number" aria-hidden="true">{String(index+2).padStart(2,'0')}</span>
                    <strong>{d.title}</strong>
                    <small>{english?'Published · Team knowledge':'已发布 · 正式资料'}</small>
                    <ArrowRight size={16}/>
                  </Link>
                </li>)}
              </ul>

              {!documents.length&&<div className="home-empty">
                <h3>{english?'No English articles yet':'正式资料正在准备中'}</h3>
                <p>{english?'Approved English articles will appear here once they’re published.':'审核并发布的文章会显示在这里。'}</p>
                {admin&&<Link prefetch={false} prefetchOnIntent href={english?'/admin':'/admin/editor'} className="secondary-link">{english?'Manage translations':'创建第一篇资料'}</Link>}
              </div>}
            </section>
          </div>

          <aside className="home-side">
           <section>
            <div className="home-section-heading">
              <h2>{english?'Recently updated':'最近修订'}</h2>
              <span>{english?'Published versions you can read':'当前可阅读的正式版本'}</span>
              <Link prefetch={false} prefetchOnIntent href={english?'/help-centre/changelog?lang=en':'/help-centre/changelog'}>{english?'View updates':'查看更新日志'} <ArrowRight size={16}/></Link>
            </div>

            <ul className="home-updates">
              {latest.map(item=>(
                <li key={item.id}>
                  <Link
                    prefetch={false}
                    prefetchOnIntent
                    href={articleContentPath(item.id)}
                  >
                    <span className="update-dot"/>

                    <strong>{item.title}</strong>

                    <time dateTime={item.updated}>
                      {new Intl.DateTimeFormat(
                        english?'en-MY':'zh-CN',
                        {
                          month:'2-digit',
                          day:'2-digit',
                          timeZone:'Asia/Kuala_Lumpur'
                        }
                      ).format(new Date(item.updated))}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>

            {!latest.length&&(
              <p className="home-empty">
                {english?'No English updates have been published yet.':'暂无已发布的修订内容。'}
              </p>
            )}
           </section>

           {showRecent&&<section className="home-recent">
              <div className="home-section-heading">
                <h2>{english?'Recently viewed':'最近浏览'}</h2>
                <span>{english?'Pick up where you left off':'快速回到你最近查看的内容'}</span>
                <Link prefetch={false} prefetchOnIntent href={english?'/help-centre/recent?lang=en':'/help-centre/recent'}>{english?'View all':'查看全部'} <ArrowRight size={16}/></Link>
              </div>

              <div className="home-recent-items">
                {recent.map(item=><Link prefetch={false} prefetchOnIntent key={item.id} href={contentPath(item.kind,item.id,locale)}>
                  <strong>{item.title}</strong>
                  <small>{english?(item.publicationNumber?`Published version ${item.publicationNumber}`:'Published'):(item.publicationNumber?`正式版本 ${item.publicationNumber}`:'已发布')}</small>
                </Link>)}
              </div>
              {!recent.length&&<p className="home-empty">{english?'Articles you read will appear here.':'阅读资料后，可在这里继续查看。'}</p>}
           </section>}
          </aside>
        </div>
      </div>
    </div>
  );
}
