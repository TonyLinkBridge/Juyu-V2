import type {ReaderIconKey} from './icon-keys.ts';
export interface NavigationPage { id:string; title:string; href:string;description?:string;iconKey?:ReaderIconKey|null }
export function navigationPage(row:{id:string;title:string;description?:string;iconKey?:ReaderIconKey|null},locale:'zh-CN'|'en'='zh-CN'):NavigationPage {
 return {id:row.id,title:row.title,href:`/help-centre?article=${encodeURIComponent(row.id)}${locale==='en'?'&lang=en':''}`,...(row.description?{description:row.description}:{}),...(row.iconKey?{iconKey:row.iconKey}:{})};
}
/** Selection can only reference an item already authorized by the server. */
export function selectNavigationPage(pages:NavigationPage[],requested:string|string[]|undefined):NavigationPage|null {
 return typeof requested==='string'?pages.find(page=>page.id===requested)??null:null;
}
