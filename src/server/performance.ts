type Stage='clerk.session'|'company.verify'|'clerk.user'|'clerk.tokens'|'slack.userinfo'|'database.scope'|'member.bind'|'reader.frame'|'database.pool'|'database.work'|'enrollment.inspect'|'page.ops'|'page.admin';
/** Fixed labels and durations only: never log IDs, SQL, tokens or vendor errors. */
export async function measured<T>(stage:Stage,work:()=>Promise<T>):Promise<T>{
 const start=performance.now();let ok=false;
 try{const result=await work();ok=true;return result;}
 finally{if(process.env.JUYU_PERFORMANCE_LOGGING==='true')console.info(JSON.stringify({event:'juyu.performance',stage,ms:Math.round(performance.now()-start),ok}));}
}
