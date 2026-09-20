import {parseSearchQuery,parseSearchScope,type SearchScope,type TitleSearch} from '../../reader/search.ts';

const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};

/** The caller supplies the same permissioned search used by the full results page. */
export async function searchDialogResponse(url:URL,search:(query:string,scope:SearchScope,locale:'zh-CN'|'en')=>Promise<TitleSearch>):Promise<Response>{
 const values=url.searchParams.getAll('q');
 const scopes=url.searchParams.getAll('scope');
 const scope=parseSearchScope(scopes.length===0?undefined:scopes.length===1?scopes[0]:scopes);
 const languages=url.searchParams.getAll('lang');const locale=languages.length===0?'zh-CN':languages.length===1&&languages[0]==='en'?'en':null;
 if([...url.searchParams.keys()].some(key=>key!=='q'&&key!=='scope'&&key!=='lang')||values.length!==1||scope===null||locale===null||parseSearchQuery(values[0]).status==='invalid')
  return Response.json({error:'INVALID_INPUT'},{status:400,headers});
 const query=parseSearchQuery(values[0]);
 if(query.status==='empty')return Response.json({...query,results:[],total:0,page:1,pages:0},{headers});
 try{return Response.json(await search(query.query,scope,locale),{headers});}
 catch(error){
  const raw=error instanceof Error?error.message.split(':')[0]:'';
  const code=raw==='FEATURE_DISABLED'?'FEATURE_DISABLED':raw.startsWith('FORBIDDEN')?'FORBIDDEN':'SEARCH_UNAVAILABLE';
  return Response.json({error:code},{status:code==='SEARCH_UNAVAILABLE'?503:403,headers});
 }
}
