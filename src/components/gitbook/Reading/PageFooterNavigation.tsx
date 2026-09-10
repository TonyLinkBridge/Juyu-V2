// Adapted from GitBook PageFooterNavigation: previous/next cards with reversed next.
import type {PageNavigation} from '../../../reader/page-navigation';
import Link from 'next/link';
export function PageFooterNavigation({previous,next}:Pick<PageNavigation,'previous'|'next'>) {
 if(!previous&&!next)return null;
 return <nav className="reader-page-navigation" aria-label="文章翻页">
   {previous?<NavigationCard label="上一篇" title={previous.title} href={previous.href}/>:null}
   {next?<NavigationCard label="下一篇" title={next.title} href={next.href} reversed/>:null}
 </nav>;
}
function NavigationCard({label,title,href,reversed=false}:{label:string;title:string;href:string;reversed?:boolean}) {
 return <Link prefetch={false} href={href} rel={reversed?'next':'prev'} className={`reader-navigation-card${reversed?' next':''}`} aria-label={`${label}：${title}`}>
   <span className="reader-navigation-arrow" aria-hidden="true">{reversed?'→':'←'}</span>
   <div><span className="reader-navigation-label">{label}</span><span className="reader-navigation-title">{title}</span></div>
 </Link>;
}
