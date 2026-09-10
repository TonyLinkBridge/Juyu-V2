export interface ReferenceItem {id:string;title:string;revision:number;tags:string[]}
export interface ReferenceTableData {id:string;headers:string[];rows:string[][]}
export interface ReferenceDetail extends ReferenceItem {tables:ReferenceTableData[]}
export interface ReferencePage {items:ReferenceItem[];total:number;page:number;pages:number;canEdit:boolean}
