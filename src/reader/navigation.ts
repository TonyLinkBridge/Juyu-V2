export interface NavigationPage { id:string; title:string; href:string }
export function navigationPage(row:{id:string;title:string}):NavigationPage {
 return {id:row.id,title:row.title,href:`/help-centre?article=${encodeURIComponent(row.id)}`};
}
/** Selection can only reference an item already authorized by the server. */
export function selectNavigationPage(pages:NavigationPage[],requested:string|string[]|undefined):NavigationPage|null {
 return typeof requested==='string'?pages.find(page=>page.id===requested)??null:null;
}
