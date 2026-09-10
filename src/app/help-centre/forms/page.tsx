import {FeaturePage} from '../../../components/features/FeaturePage';
import {ReaderMenu} from '../../../components/navigation-settings/ReaderMenu';
import {requireFormReaderEntry} from '../../../server/forms/entry';
import {applicationAuthorization} from '../../../server/authorization/application';
import {EntryShell} from '../../../components/entry-shell';
import {FormCollection} from '../../../components/forms/FormViews';
import type {FormDefinition} from '../../../forms/model';
import '../../forms.css';
export const dynamic='force-dynamic';
export default async function FormsPage(){await requireFormReaderEntry();let data:FormDefinition[]|undefined;try{data=await(await applicationAuthorization()).forms();}catch{}return <FeaturePage feature="forms"><EntryShell navigation={<ReaderMenu currentHref="/help-centre/forms"/>}><main id="main-content" className="forms-main"><FormCollection data={data}/></main></EntryShell></FeaturePage>;}
