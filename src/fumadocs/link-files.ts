import type {ContentKind} from '../domain/model.ts';
import {publicationMarkdown} from '../reader/markdown.ts';
import {contentPath} from '../reader/content-path.ts';
import {publicationSlugPath} from './slugs.ts';
import {fumadocsPublication} from './publication.ts';
import type {FileObject,ScanOptions} from 'next-validate-link';

export interface PublicationLinkSource {
 id:string;
 kind:ContentKind;
 slug:string|null;
 title:string;
 description?:string;
 body:string;
 revision:number;
 locale?:'zh-CN'|'en';
}

export interface PublicationLinkFile extends FileObject {data:{id:string;revision:number;kind:ContentKind;slug:string|null}}

export function publicationLinkFile(article:PublicationLinkSource):PublicationLinkFile{
 const slug=article.kind==='article'||article.kind==='ops'?(article.slug??(()=>{throw new Error('MISSING_PUBLICATION_SLUG');})()):article.id;
 return {
  path:`database/${article.kind}/${article.id}.md`,
  content:publicationMarkdown({...article,slug:undefined}),
  url:article.kind==='article'||article.kind==='ops'?publicationSlugPath(slug,article.kind==='ops'?'ops':'article'):contentPath(article.kind,article.id,article.locale),
  data:{id:article.id,revision:article.revision,kind:article.kind,slug:article.slug},
 };
}

export function publicationLinkScanOptions(publications:PublicationLinkSource[]):Pick<ScanOptions,'populate'|'meta'>{
 const articles:NonNullable<ScanOptions['populate']>[string]=[];
 const operations:NonNullable<ScanOptions['populate']>[string]=[];
 const qaQueries:Record<string,string>[]=[],referenceQueries:Record<string,string>[]=[];
 for(const publication of publications){
  if(publication.kind==='article'||publication.kind==='ops'){
   if(!publication.slug)throw new Error('MISSING_PUBLICATION_SLUG');
   const route={value:{articleId:publication.slug},hashes:fumadocsPublication(publication).toc.map(item=>item.url.slice(1))};
   (publication.kind==='ops'?operations:articles).push(route);
  }else{
   const query={...(publication.kind==='qa'?{question:publication.id}:{article:publication.id}),...(publication.locale==='en'?{lang:'en'}:{})};
   (publication.kind==='qa'?qaQueries:referenceQueries).push(query);
  }
 }
 return {
  populate:{'help-centre/articles/[articleId]':articles,'help-centre/ops/[articleId]':operations},
  meta:{'help-centre/qa':{queries:qaQueries},'help-centre/reference':{queries:referenceQueries}},
 };
}
