import type {CategoryDefinition} from '../categories/model.ts';
import type {FieldDefinition,FieldSnapshot} from '../fields/model.ts';
import type {QaMetadata} from '../qa/model.ts';
import type {Audience,ContentKind} from '../domain/model.ts';
import type {ArticleCover} from '../domain/presentation.ts';
import type {MediaEditorData} from '../media/editor.ts';
export interface EditorData extends MediaEditorData {categoryOptions?:CategoryDefinition[];categoryIds?:string[];fieldDefinitions?:FieldDefinition[];customFields?:FieldSnapshot[];qa?:QaMetadata;kind:ContentKind;audience:Audience;publishedRevision:number|null}
export interface SaveDraftInput {categoryIds?:string[];customFields?:FieldSnapshot[];qa?:QaMetadata;expectedSequence:number|null;title:string;body:string;kind:ContentKind;audience:Audience;tags:string[];cover:ArticleCover|null}
