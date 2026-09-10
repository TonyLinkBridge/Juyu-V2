import {readReaderPresentation} from '../../server/reader-presentation';
import {SearchInput} from '../gitbook/Search/SearchInput';
export async function FeatureSearch({query=''}:{query?:string}){let enabled=false;try{enabled=(await readReaderPresentation()).features.search;}catch{}return enabled?<SearchInput query={query}/>:null;}
