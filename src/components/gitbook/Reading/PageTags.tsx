// Adapted from GitBook PageTags and Tag: optional wrapping label collection.
export function PageTags({tags,locale='zh-CN'}:{tags?:string[];locale?:'zh-CN'|'en'}) {
 if(!tags?.length)return null;
 return <ul aria-label={locale==='en'?'Article tags':'文章标签'} className="reader-page-tags">
   {tags.map(tag=><li key={tag}><span data-tag="" title={tag} className="reader-tag"><span>{tag}</span></span></li>)}
 </ul>;
}
