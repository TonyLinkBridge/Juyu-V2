export interface QaMetadata {category:string;position:number}
export interface QaItem extends QaMetadata {id:string;title:string;revision:number;tags:string[]}
export interface QaPage {items:QaItem[];total:number;page:number;pages:number;canEdit:boolean;category?:string;q?:string;categories?:string[]}
