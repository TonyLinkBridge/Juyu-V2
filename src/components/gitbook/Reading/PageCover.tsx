// Adapted from GitBook PageCover's bounded hero branch (GPL-3.0).
import {normalizePresentation,type ArticleCover} from '../../../domain/presentation';
import {PageCoverImage} from './PageCoverImage';
export function PageCover({cover,locale='zh-CN'}:{cover?:ArticleCover|null;locale?:'zh-CN'|'en'}) {
 if(!cover)return null;
 let normalized:ArticleCover|null;
 try{normalized=normalizePresentation({cover}).cover;}catch{return null;}
 if(!normalized)return null;
 return <div data-gb-page-cover="" data-cover-type="hero" className="reader-page-cover">
   <PageCoverImage key={normalized.assetId} cover={normalized} locale={locale}/>
 </div>;
}
