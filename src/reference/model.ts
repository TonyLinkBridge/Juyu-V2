import type {TableContent} from '../editor/table.ts';
export interface ReferenceItem {id:string;title:string;revision:number;tags:string[]}
export interface ReferenceTableData {id:string;headers:string[];rows:string[][];native?:{props:{textColor:string};content:TableContent}}
export interface ReferenceDetail extends ReferenceItem {tables:ReferenceTableData[]}
export interface ReferencePage {items:ReferenceItem[];total:number;page:number;pages:number;canEdit:boolean}
