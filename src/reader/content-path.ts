import type {ContentKind} from '../domain/model.ts';
export function articleContentPath(id:string):string{return `/help-centre/articles/${encodeURIComponent(id)}`;}
/** Entry selection only; destination routes still authorize the current reader. */
export function contentPath(kind:ContentKind,id:string,locale:'zh-CN'|'en'='zh-CN'):string{
 const encoded=encodeURIComponent(id);
 const language=locale==='en'?'&lang=en':'';
 if(kind==='qa')return `/help-centre/qa?question=${encoded}${language}#qa-${encoded}`;
 if(kind==='reference')return `/help-centre/reference?article=${encoded}${language}`;
 return articleContentPath(id);
}
