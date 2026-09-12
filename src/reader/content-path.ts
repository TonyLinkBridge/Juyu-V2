import type {ContentKind} from '../domain/model.ts';
/** Entry selection only; destination routes still authorize the current reader. */
export function contentPath(kind:ContentKind,id:string):string{
 const encoded=encodeURIComponent(id);
 if(kind==='qa')return `/help-centre/qa?question=${encoded}#qa-${encoded}`;
 if(kind==='reference')return `/help-centre/reference?article=${encoded}`;
 return `/help-centre?article=${encoded}`;
}
