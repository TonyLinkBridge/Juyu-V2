export function qaQuery(url:URL):{page:number;category?:string}{
 const p=url.searchParams,page=p.get('page')??'1',category=p.get('category');
 if([...p.keys()].some(k=>!['page','category'].includes(k))||p.getAll('page').length>1||p.getAll('category').length>1||!/^[1-9]\d{0,5}$/.test(page)||(category!==null&&([...category.trim()].length>80||/[\u0000-\u001f\u007f-\u009f]/.test(category))))throw new Error('INVALID_INPUT');
 return {page:Number(page),...(category!==null?{category:category.trim()}:{})};
}
export async function qaResponse(action:()=>Promise<unknown>){
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(error){const raw=error instanceof Error?error.message.split(':')[0]:'';const code=['FORBIDDEN','INVALID_INPUT'].includes(raw)?raw:'QA_UNAVAILABLE';return Response.json({error:code},{headers,status:code==='FORBIDDEN'?403:code==='INVALID_INPUT'?400:503});}
}
