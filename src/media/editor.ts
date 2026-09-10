import type {ArticleCover} from '../domain/presentation.ts';
import type {MediaBlock,ManagedAsset} from './model.ts';
export interface MediaEditorData {documentId:string;title:string;body:string;sequence:number;status:string;lifecycle:string;blocks:MediaBlock[];cover:ArticleCover|null;tags:string[];assets:ManagedAsset[]}
