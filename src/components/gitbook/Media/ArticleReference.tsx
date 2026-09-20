'use client';
import type {MediaBlock} from '../../../media/model';
import {ReaderIcon} from '../../../reader/icons';
import {useAuthorizedReference,useReaderLocale} from './ArticleReferenceContext';

export function ArticleReference({block,admin=false}:{block:Extract<MediaBlock,{type:'articleReference'}>;admin?:boolean}){
 const page=useAuthorizedReference(block.targetId);
 const english=useReaderLocale()==='en';
 if(!page)return <div className="article-reference unavailable" role="note">{english?(admin?'This reference will follow employee access rules after publication.':'This referenced article is unavailable.'):(admin?'文章引用将在发布后按员工权限显示。':'引用的资料目前无法阅读。')}</div>;
 return <a className="article-reference" href={page.href} aria-label={english?`Read article: ${page.title}`:`阅读文章：${page.title}`}>
  <span className="article-reference-icon"><ReaderIcon icon={page.iconKey??'file'} size={20}/></span>
  <span className="article-reference-copy"><strong>{page.title}</strong>{page.description&&<small>{page.description}</small>}</span>
  <span className="article-reference-arrow" aria-hidden="true">↗</span>
 </a>;
}
