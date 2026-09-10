import {readReaderPresentation} from '../../server/reader-presentation';
import type {MenuItem} from '../../navigation-settings/model';
import {ReaderQuickLinks} from './ReaderQuickLinks';
/** Only mounted after the page's member entry gate. Never serialize editable settings into employee HTML. */
export async function ReaderMenu({currentHref}:{currentHref?:string}){
 let items:MenuItem[]|undefined;let failed=false;
 try{items=(await readReaderPresentation()).items;}
 catch{failed=true;}
 return <><ReaderQuickLinks items={items} currentHref={currentHref} unavailable={failed}/></>;
}
