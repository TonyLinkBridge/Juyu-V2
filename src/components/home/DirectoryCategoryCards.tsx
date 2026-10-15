import {ArrowRight} from '@phosphor-icons/react/dist/ssr';
import {NavigationLink as Link} from '../shell/NavigationLink';
import {ReaderIcon} from '../../reader/icons';
import type {ReaderIconKey} from '../../reader/icon-keys';
export interface DirectoryCard {id:string;title:string;href:string;iconKey?:ReaderIconKey|null;topics:string[];articles:string[]}
export function DirectoryCategoryCards({cards,locale='zh-CN',action}:{cards:DirectoryCard[];locale?:'zh-CN'|'en';action?:string}){
 const english=locale==='en';
 return <div className="directory-category-grid">{cards.map(card=><Link className="directory-category-card" prefetch={false} prefetchOnIntent key={card.id} href={card.href}>
 {card.iconKey&&<ReaderIcon icon={card.iconKey} size={36} className="directory-category-icon"/>}
 <div className="directory-category-copy"><h3>{card.title}</h3><p className="directory-category-topics">{card.topics.length?card.topics.join(' · '):(english?'Browse published content in this topic':'查看本分类下的正式资料')}</p>{card.articles.length>0&&<p className="directory-category-preview">{card.articles.join(' · ')}</p>}</div>
 <span className="directory-category-action">{action??(english?'Browse topic':'查看分类')}<ArrowRight size={17} aria-hidden="true"/></span>
 </Link>)}</div>;
}
