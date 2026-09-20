import type {CategoryDefinition} from '../../../categories/model';
import type {FieldDefinition} from '../../../fields/model';
import {redirect} from 'next/navigation';
import {currentAdminAccess} from '../../../server/authentication/admin-entry';
import {adminDestination} from '../../../server/authentication/admin';
import {applicationAuthorization} from '../../../server/authorization/application';
import {EntryShell} from '../../../components/entry-shell';
import {EditorLoader,type NewTranslation} from '../../../components/editor/EditorLoader';
import type {EditorData} from '../../../editor/contract';
export const dynamic='force-dynamic';
export default async function EditorPage({searchParams}:{searchParams:Promise<{article?:string|string[];kind?:string|string[];translate?:string|string[]}>}){
 const access=await currentAdminAccess();if(access.status!=='admin')redirect(adminDestination(access));
 const params=await searchParams;let initial:EditorData|null=null,failed=false,newTranslation:NewTranslation|undefined,existingTranslationId:string|undefined;let fieldDefinitions:FieldDefinition[]=[],categoryOptions:CategoryDefinition[]=[];
 try{const service=await applicationAuthorization();await service.requireEditorAdmin();if(params.kind!==undefined&&params.kind!=='reference'&&params.kind!=='qa'&&params.kind!=='ops')throw new Error('INVALID_INPUT');if(params.article!==undefined&&params.translate!==undefined)throw new Error('INVALID_INPUT');if(params.article!==undefined){if(typeof params.article!=='string')throw new Error('INVALID_INPUT');initial=await service.editor(params.article);}else if(params.translate!==undefined){if(typeof params.translate!=='string')throw new Error('INVALID_INPUT');const source=await service.editor(params.translate);if(source.locale!=='zh-CN')throw new Error('INVALID_INPUT');if(source.translation)existingTranslationId=source.translation.documentId;else{newTranslation={sourceId:source.documentId,sourceTitle:source.title,kind:source.kind,audience:source.audience,categoryIds:source.categoryIds??[]};fieldDefinitions=source.fieldDefinitions??[];categoryOptions=source.categoryOptions??[];}}else [fieldDefinitions,categoryOptions]=await Promise.all([service.fields(),service.categories()]);}catch{failed=true;}
 if(existingTranslationId)redirect(`/admin/editor?article=${encodeURIComponent(existingTranslationId)}`);
 return <EntryShell><main id="main-content" className="editor-main"><h1 className="sr-only">{params.article?"编辑文章":newTranslation?"撰写英文版本":"新建文章"}</h1>{failed?<section role="status"><p>编辑内容暂时无法读取，请重新载入或返回内容管理。</p><a href={typeof params.article==='string'?`/admin/editor?article=${encodeURIComponent(params.article)}`:typeof params.translate==='string'?`/admin/editor?translate=${encodeURIComponent(params.translate)}`:'/admin/editor'}>重新读取</a></section>:<EditorLoader recoveryOwner={access.userId} categoryOptions={categoryOptions} fieldDefinitions={fieldDefinitions} initial={initial} newTranslation={newTranslation} newReference={params.article===undefined&&params.kind==='reference'} newQa={params.article===undefined&&params.kind==='qa'} newOps={params.article===undefined&&params.kind==='ops'}/>}</main></EntryShell>;
}
