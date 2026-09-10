export interface OpsItem {id:string;title:string;revision:number;tags:string[]}
export interface OpsPage {items:OpsItem[];total:number;page:number;pages:number}
export interface ReaderSections {ops:boolean}
