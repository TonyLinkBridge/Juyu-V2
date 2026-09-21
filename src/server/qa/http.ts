export function qaQuery(url:URL):{page:number;category?:string;topic?:string;q?:string;locale:'zh-CN'|'en'}{
 const p=url.searchParams,page=p.get('page')??'1',category=p.get('category'),topic=p.get('topic'),q=p.get('q'),lang=p.get('lang');
 if(p.getAll('q').length>1||(q!==null&&([...q.trim()].length>120||/[\u0000-\u001f\u007f-\u009f]/.test(q))))throw new Error('INVALID_INPUT');
 if([...p.keys()].some(k=>!['page','category','topic','q','lang'].includes(k))||p.getAll('page').length>1||p.getAll('category').length>1||p.getAll('topic').length>1||p.getAll('lang').length>1||(lang!==null&&lang!=='en')||!/^[1-9]\d{0,5}$/.test(page)||(category!==null&&([...category.trim()].length>80||/[\u0000-\u001f\u007f-\u009f]/.test(category)))||(topic!==null&&(!topic.trim()||[...topic.trim()].length>40||/[\u0000-\u001f\u007f-\u009f]/.test(topic))))throw new Error('INVALID_INPUT');
 return {page:Number(page),locale:lang==='en'?'en':'zh-CN',...(q!==null?{q:q.trim()}:{}),...(category!==null?{category:category.trim()}:{}),...(topic!==null?{topic:topic.trim()}:{})};
}
export async function qaResponse(action:()=>Promise<unknown>){
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){const raw=error instanceof Error?error.message.split(':')[0]:'';const code=['FORBIDDEN','INVALID_INPUT'].includes(raw)?raw:'QA_UNAVAILABLE';return Response.json({error:code},{headers,status:code==='FORBIDDEN'?403:code==='INVALID_INPUT'?400:503});}
}
