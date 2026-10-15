import {articleContentPath,contentPath} from '../../reader/content-path';
import {NavigationLink as Link} from '../shell/NavigationLink';
import {ArrowRight} from '@phosphor-icons/react/dist/ssr';
import type {RecentItem} from '../../recent/model';

export function KnowledgeHomeActivity({latest,recent,showRecent=true,locale='zh-CN'}:{latest:{id:string;title:string;updated:string}[];recent:RecentItem[];showRecent?:boolean;locale?:'zh-CN'|'en'}){
 const english=locale==='en';
 return (
          <div className="home-activity">
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
          </div>
 );
}
