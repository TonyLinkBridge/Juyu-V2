import {contentPath} from '../../reader/content-path';
import {NavigationLink as Link} from '../shell/NavigationLink';
import {FileText,LinkSimple,Chats,Shield,ArrowRight,Clock} from '@phosphor-icons/react/dist/ssr';
import type {NavigationNode} from '../../reader/tree';
import type {MenuItem} from '../../navigation-settings/model';
import type {RecentItem} from '../../recent/model';
import {SearchInput} from '../gitbook/Search/SearchInput';

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

  return (
    <main id="main-content" className="knowledge-home">
      <section className="home-hero">
        <p className="home-eyebrow">
          {english?'JUYU team knowledge and operations':'JUYU 内部知识与运营中心'}
        </p>

        <h1>{english?'What can we help you find?':'今天需要找什么答案？'}</h1>

        <p className="home-description">
          {english?'Find clear, approved guidance for the work in front of you.':'从正式知识与业务速查中，找到可靠的处理依据。'}
        </p>

        {search&&(
          <div className="home-search">
            <SearchInput query="" locale={locale}/>
          </div>
        )}

        <div className="home-entries">
          {entries.map(item=>{
            const Icon=
              item.href.includes('ops')
                ? Shield
                : item.href.includes('reference')
                  ? LinkSimple
                  : item.href.includes('qa')
                    ? Chats
                    : FileText;

            return (
              <Link
                prefetch={false}
                prefetchOnIntent
                key={item.id}
                href={
                  item.href==='/help-centre'
                    ? english?'/help-centre/library?lang=en':'/help-centre/library'
                    : english&&['/help-centre/ops','/help-centre/reference','/help-centre/qa'].includes(item.href)
                      ? `${item.href}?lang=en`
                      : item.href
                }
              >
                <span className="home-entry-icon">
                  <Icon size={27}/>
                </span>

                <div>
                  <h2>{english?item.href==='/help-centre'?'Articles':item.href.includes('ops')?'OPS Internal':item.href.includes('reference')?'Reference':item.href.includes('qa')?'Q&A':item.label:item.href==='/help-centre'?'知识文章':item.label}</h2>

                  <p>
                    {english?item.href.includes('ops')?'Internal operations guidance.':item.href.includes('reference')?'Key facts and business rules.':item.href.includes('qa')?'Answers to common questions.':'Browse approved team guidance.':item.href.includes('ops')
                      ? '查阅内部运营流程、异常与升级处理。'
                      : item.href.includes('reference')
                        ? '快速查询关键信息，对照业务规则。'
                        : item.href.includes('qa')
                          ? '查看常见问题与标准解答。'
                          : '浏览团队正式资料，了解流程与操作规范。'}
                  </p>
                </div>

                <ArrowRight size={18}/>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="home-content">
        <div className="home-columns">
          <section id="knowledge-documents">
            <div className="home-section-heading">
              <h2>{english?'Articles':'知识资料'}</h2>
              <span>{english?'Approved guidance for your team':'按业务查阅团队的正式文档'}</span>
            </div>

            <ul className="home-document-list">
              {documents.slice(0,4).map(d=>(
                <li key={d.id}>
                  <Link
                    prefetch={false}
                    prefetchOnIntent
                    href={d.href}
                  >
                    <span className="home-document-icon">
                      <FileText size={24}/>
                    </span>

                    <div>
                      <strong>{d.title}</strong>
                      <small>{english?'Published · Team knowledge':'已发布 · 正式资料'}</small>
                    </div>

                    <ArrowRight size={16}/>
                  </Link>
                </li>
              ))}
            </ul>

            {!documents.length&&(
              <div className="home-empty">
                <h3>{english?'No English articles yet':'正式资料正在准备中'}</h3>

                <p>{english?'Approved English articles will appear here once they’re published.':'审核并发布的文章会显示在这里。'}</p>

                {admin&&(
                  <Link
                    prefetch={false}
                    prefetchOnIntent
                    href={english?'/admin':'/admin/editor'}
                    className="secondary-link"
                  >
                    {english?'Manage translations':'创建第一篇资料'}
                  </Link>
                )}
              </div>
            )}
          </section>

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
                    href={`/help-centre?article=${encodeURIComponent(item.id)}${english?'&lang=en':''}`}
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
        </div>

        {showRecent&&(
          <section className="home-recent">
            <div className="home-section-heading">
              <h2>{english?'Recently viewed':'最近浏览'}</h2>
              <span>{english?'Pick up where you left off':'快速回到你最近查看的内容'}</span>

              <Link
                prefetch={false}
                prefetchOnIntent
                href={english?'/help-centre/recent?lang=en':'/help-centre/recent'}
              >
                {english?'View all':'查看全部'} <ArrowRight size={16}/>
              </Link>
            </div>

            <div className="home-recent-items">
              {recent.map(item=>(
                <Link
                  prefetch={false}
                  prefetchOnIntent
                  key={item.id}
                  href={contentPath(item.kind,item.id,locale)}
                >
                  <Clock size={22}/>

                  <div>
                    <strong>{item.title}</strong>
                    <small>{english?(item.publicationNumber?`Published version ${item.publicationNumber}`:'Published'):(item.publicationNumber?`正式版本 ${item.publicationNumber}`:'已发布')}</small>
                  </div>
                </Link>
              ))}
            </div>

            {!recent.length&&(
              <p className="home-empty">
                {english?'Articles you read will appear here.':'阅读资料后，可在这里继续查看。'}
              </p>
            )}
          </section>
        )}


      </div>
    </main>
  );
}
