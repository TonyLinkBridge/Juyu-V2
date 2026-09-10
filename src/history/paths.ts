/** Historical admin previews carry an exact document and revision; employee paths remain publication-scoped. */
export function mediaAssetUrl(assetId:string,admin=false,documentId?:string,revision?:number):string{
 if(admin&&documentId&&Number.isInteger(revision)&&revision!>0)return `/api/admin/history/${encodeURIComponent(documentId)}/versions/${revision}/assets/${encodeURIComponent(assetId)}`;
 return `/api/${admin?'admin/':''}assets/${encodeURIComponent(assetId)}`;
}
export function adminDiagramUrl(documentId:string,revision?:number):string{
 return Number.isInteger(revision)&&revision!>0?`/api/admin/history/${encodeURIComponent(documentId)}/versions/${revision}/diagram`:`/api/admin/media/${encodeURIComponent(documentId)}/diagram`;
}
