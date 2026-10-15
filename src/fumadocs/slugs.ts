export type PublicationSlugSection='article'|'ops';

/**
 * Decode once and preserve a stored slug exactly. Historical slugs predate the
 * current NFKC creation rule; normalizing them here would break immutable URLs.
 * This validates a single safe database path segment, not a new title.
 */
export function publicationPathValue(value:string):string{
 try{
  const decoded=decodeURIComponent(value);
  if(!decoded||[...decoded].length>250||decoded==='.'||decoded==='..'||/[\s/\\?#%\u0000-\u001f\u007f]/u.test(decoded))throw new Error('INVALID_PUBLICATION_PATH');
  return decoded;
 }catch{throw new Error('INVALID_PUBLICATION_PATH');}
}

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
 const value=publicationPathValue(encodeURIComponent(slug));
 return `${section==='ops'?'/help-centre/ops/':'/help-centre/articles/'}${encodeURIComponent(value)}`;
}
