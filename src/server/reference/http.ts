export function referenceQuery(url:URL):{page:number;article?:string;locale:'zh-CN'|'en'}{
 const p=url.searchParams,page=p.get('page')??'1',article=p.get('article'),lang=p.get('lang');
 if([...p.keys()].some(k=>!['page','article','lang'].includes(k))||p.getAll('page').length>1||p.getAll('article').length>1||p.getAll('lang').length>1||(lang!==null&&lang!=='en')||!/^[1-9]\d{0,5}$/.test(page)||(article!==null&&(!article.trim()||article.length>200||/[\u0000-\u001f\u007f]/.test(article))))throw new Error('INVALID_INPUT');
 return {page:Number(page),locale:lang==='en'?'en':'zh-CN',...(article!==null?{article}:{})};
}
export async function referenceResponse(action:()=>Promise<unknown>){
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){const raw=error instanceof Error?error.message.split(':')[0]:'';const code=['FORBIDDEN','NOT_FOUND','INVALID_INPUT'].includes(raw)?raw:'REFERENCE_UNAVAILABLE';return Response.json({error:code},{headers,status:code==='FORBIDDEN'?403:code==='NOT_FOUND'?404:code==='INVALID_INPUT'?400:503});}
}
