import type {ContentKind} from '../domain/model.ts';
import {positiveInteger} from '../feedback/model.ts';
export interface FavoriteInput {revision:number;saved:boolean}
export interface FavoriteState extends FavoriteInput {documentId:string}
export interface FavoriteItem {id:string;title:string;kind:ContentKind;revision:number;tags:string[];savedAt:string}
export interface FavoritesPage {items:FavoriteItem[];total:number;page:number;pages:number}
export function favoriteInput(value:unknown):FavoriteInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_INPUT');
 const input=value as Record<string,unknown>;
 if(Object.keys(input).length!==2||!Object.hasOwn(input,'revision')||!Object.hasOwn(input,'saved')||typeof input.saved!=='boolean')throw new Error('INVALID_INPUT');
 return {revision:positiveInteger(input.revision),saved:input.saved};
}
