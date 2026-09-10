import {applicationAuthorization} from '../../server/authorization/application';
import {SearchInput} from '../gitbook/Search/SearchInput';
export async function FeatureSearch({query=''}:{query?:string}){let enabled=false;try{enabled=(await(await applicationAuthorization()).features()).search;}catch{}return enabled?<SearchInput query={query}/>:null;}
