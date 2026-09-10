export async function workspaceResponse(action:()=>Promise<unknown>){
 const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
 try{return Response.json(await action(),{headers});}catch(e){
  const message=e instanceof Error?e.message:'';
  const status=message.startsWith('FORBIDDEN')?403:message==='INVALID_QUERY'?400:503;
  return Response.json({error:status===403?'没有访问权限':status===400?'筛选条件无效，请重设。':'内容暂时无法读取，请稍后重试。'},{status,headers});
 }
}
