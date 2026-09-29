export type PublicationSlugSection='article'|'ops';

/**
 * Database equivalent of a Fumadocs page filename. It deliberately keeps
 * non-ASCII text so an authored Chinese title remains a Chinese page slug.
 */
export function publicationSlug(title:string):string{
 const slug=title.normalize('NFKC').trim().toLocaleLowerCase('en-US')
  .replace(/[\s/\\?#%]+/g,'-')
  .replace(/^-+|-+$/g,'');
 if(!slug||[...slug].length>240||/[\u0000-\u001f\u007f]/.test(slug))throw new Error('INVALID_SLUG');
 return slug;
}

export function publicationSlugPath(slug:string,section:PublicationSlugSection='article'):string{
 const value=publicationSlug(slug);
 return `${section==='ops'?'/help-centre/ops/':'/help-centre/articles/'}${encodeURIComponent(value)}`;
}
