import type {CategoryDefinition} from '../categories/model.ts';
import type {FieldDefinition,FieldSnapshot} from '../fields/model.ts';
import type {QaMetadata} from '../qa/model.ts';
import type {Audience,ContentKind} from '../domain/model.ts';
import type {ArticleCover} from '../domain/presentation.ts';
import type {ReaderIconKey} from '../reader/icon-keys.ts';
import type {MediaEditorData} from '../media/editor.ts';
export interface EditorData extends MediaEditorData {locale?:'zh-CN'|'en';translationOf?:string|null;translation?:{documentId:string;status:string;publishedRevision:number|null}|null;description?:string;releaseNote?:string;publicationNumber?:number|null;categoryOptions?:CategoryDefinition[];categoryIds?:string[];fieldDefinitions?:FieldDefinition[];customFields?:FieldSnapshot[];qa?:QaMetadata;kind:ContentKind;audience:Audience;publishedRevision:number|null;iconKey?:ReaderIconKey|null}
export interface SaveDraftInput {locale?:'zh-CN'|'en';translationOf?:string|null;categoryIds?:string[];customFields?:FieldSnapshot[];qa?:QaMetadata;expectedSequence:number|null;title:string;description?:string;releaseNote?:string;body:string;kind:ContentKind;audience:Audience;tags:string[];cover:ArticleCover|null;iconKey?:ReaderIconKey|null}
