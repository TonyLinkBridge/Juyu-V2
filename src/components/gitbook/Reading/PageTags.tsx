// Adapted from GitBook PageTags and Tag: optional wrapping label collection.
export function PageTags({tags}:{tags?:string[]}) {
 if(!tags?.length)return null;
 return <ul aria-label="文章标签" className="reader-page-tags">
   {tags.map(tag=><li key={tag}><span data-tag="" title={tag} className="reader-tag"><span>{tag}</span></span></li>)}
 </ul>;
}
