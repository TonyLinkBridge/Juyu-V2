import {requireFormReaderEntry} from '../../../../server/forms/entry';
import {applicationAuthorization} from '../../../../server/authorization/application';
import {EntryShell} from '../../../../components/entry-shell';
import {ReaderMenu} from '../../../../components/navigation-settings/ReaderMenu';
import {CategoryLanding} from '../../../../components/navigation-settings/CategoryLanding';
import {FeatureSearch} from '../../../../components/features/FeatureSearch';
import {redirect} from 'next/navigation';
import {categoryPage} from '../../../../reader/category-page';
import {formPage} from '../../../../server/forms/http';
export const dynamic='force-dynamic';
export default async function CategoryPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireFormReaderEntry();const {id}=await params;let data=null,failed=false;
 try{const query=await searchParams,url=new URL('http://local/');for(const [key,value] of Object.entries(query)){if(typeof value!=='string')throw new Error('INVALID_INPUT');url.searchParams.set(key,value);}data=categoryPage(await(await applicationAuthorization()).categoryNavigationTree(),id,formPage(url));}
 catch(e){failed=!(e instanceof Error&&['INVALID_INPUT','FORBIDDEN','NOT_FOUND'].includes(e.message.split(':')[0]));}
 // Redirect outside the catch: Next redirects throw to finish the response.
 if(data?.items[0])redirect(data.items[0].href);
 return <EntryShell account search={<FeatureSearch/>} navigation={<ReaderMenu currentHref={`/help-centre/categories/${id}`}/>}><main id="main-content" className="editor-main search-main"><CategoryLanding data={data} failed={failed}/></main></EntryShell>;
}
