import type {ContentKind} from '../domain/model.ts';
/** Entry selection only; destination routes still authorize the current reader. */
export function contentPath(kind:ContentKind,id:string,locale:'zh-CN'|'en'='zh-CN'):string{
 const encoded=encodeURIComponent(id);
 const language=locale==='en'?'&lang=en':'';
 if(kind==='qa')return `/help-centre/qa?question=${encoded}${language}#qa-${encoded}`;
 if(kind==='reference')return `/help-centre/reference?article=${encoded}${language}`;
 return `/help-centre?article=${encoded}${language}`;
}
