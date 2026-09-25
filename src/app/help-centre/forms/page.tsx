import {requireFormReaderEntry} from '../../../server/forms/entry';
import {applicationAuthorization} from '../../../server/authorization/application';
import type {FormDefinition} from '../../../forms/model';
import {FumadocsFormsPage} from '../../../components/fumadocs/FumadocsFormsPage';
import {readReaderPresentation} from '../../../server/reader-presentation';
export const dynamic='force-dynamic';
export default async function FormsPage(){
 await requireFormReaderEntry();
 let data:FormDefinition[]|undefined,state:'ready'|'disabled'|'unavailable'='unavailable';
 try{const service=await applicationAuthorization(),features=await service.features();if(!features.forms)state='disabled';else{data=await service.forms();state='ready';}}catch{}
 let menu:Awaited<ReturnType<typeof readReaderPresentation>>['items']=[],search=false;
 try{const presentation=await readReaderPresentation();menu=presentation.items;search=presentation.features.search;}catch{}
 return <FumadocsFormsPage data={data} state={state} menu={menu} search={search}/>;
}
