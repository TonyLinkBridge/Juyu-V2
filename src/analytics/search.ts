import type {TitleSearch} from '../reader/search.ts';
export type SearchSnapshot={eventId:string;query:string;page:number;total:number;results:{documentId:string;revision:number}[]};
export function analyticsSearchSnapshot(search:TitleSearch,eventId:string):SearchSnapshot|null {
 if(search.status!=='ready'||!search.query||search.results.some(item=>!Number.isSafeInteger(item.revision)||Number(item.revision)<1))return null;
 return {eventId,query:search.query,page:search.page,total:search.total,results:search.results.map(item=>({documentId:item.id,revision:item.revision!}))};
}
export function clickedSearchResult(search:TitleSearch,href:string,origin:string){
 let url:URL;try{url=new URL(href,origin);}catch{return null;}if(url.origin!==origin)return null;
 const index=search.results.findIndex(item=>new URL(item.href,origin).href===url.href);if(index<0||!Number.isSafeInteger(search.results[index].revision))return null;
 return {documentId:search.results[index].id,revision:search.results[index].revision!,position:(search.page-1)*20+index+1};
}
