import type {NavigationPage} from '../../reader/navigation';
import type {EditorBlock} from '../../editor/document';
import {FumadocsBlockNoteHydrated} from './FumadocsBlockNoteHydrated';
import {FumadocsBlockNoteStatic} from './FumadocsBlockNoteStatic';

export function FumadocsBlockNoteReader({blocks,published=false,locale='zh-CN',documentId,revision,referencePages,referenceAliases}:{blocks:unknown[];published?:boolean;locale?:'zh-CN'|'en';documentId?:string;revision?:number;referencePages?:NavigationPage[];referenceAliases?:Record<string,string>}){
 const fallback=published?<FumadocsBlockNoteStatic key="fumadocs-blocknote-server" blocks={blocks as EditorBlock[]} locale={locale}/>:null;
 return <FumadocsBlockNoteHydrated blocks={blocks} published={published} locale={locale} documentId={documentId} revision={revision} referencePages={referencePages} referenceAliases={referenceAliases} fallback={fallback}/>;
}
