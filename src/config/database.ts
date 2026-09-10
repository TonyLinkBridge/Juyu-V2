import type { Environment } from './readiness.ts';
export type DatabaseConfiguration={state:'missing'|'invalid'}|{state:'configured';runtime:string;issuer:string};
export function databaseConfiguration(env:Environment):DatabaseConfiguration{
 const runtime=env.JUYU_DATABASE_RUNTIME_URL?.trim(),issuer=env.JUYU_DATABASE_ISSUER_URL?.trim();
 if(!runtime&&!issuer)return {state:'missing'};
 if(!runtime||!issuer)return {state:'invalid'};
 try{
  const urls=[new URL(runtime),new URL(issuer)];
  for(const url of urls){
   const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
   if(!['postgres:','postgresql:'].includes(url.protocol)||!url.username||!url.password||url.pathname.length<2||url.hash
    ||[...url.searchParams.keys()].some(key=>key!=='sslmode')||url.searchParams.getAll('sslmode').length>1
    ||(!local&&url.searchParams.get('sslmode')!=='verify-full'))return {state:'invalid'};
  }
  if(urls[0].username===urls[1].username||urls[0].host!==urls[1].host||urls[0].pathname!==urls[1].pathname)return {state:'invalid'};
  return {state:'configured',runtime,issuer};
 }catch{return {state:'invalid'};}
}
