import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {Pool} from 'pg';
import {printErrors,scanURLs,validateFiles} from 'next-validate-link';
import {databaseConfiguration} from '../src/config/database.ts';
import {databasePoolOptions} from '../src/config/database-tls.ts';
import {canManage} from '../src/domain/access.ts';
import {publicationLinkFile,publicationLinkScanOptions,type PublicationLinkSource} from '../src/fumadocs/link-files.ts';
import {ScopedDatabase} from '../src/server/database/scoped.ts';
import {MemberStore} from '../src/server/members/store.ts';

async function loadLocalEnvironment(){
 try{
  const local=parseEnv(await readFile('.env.local','utf8'));
  for(const [key,value] of Object.entries(local))process.env[key]??=value;
 }catch(error){
  if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
 }
}

async function main(){
 await loadLocalEnvironment();
 const config=databaseConfiguration(process.env);
 const actorId=process.env.JUYU_VALIDATE_LINKS_ACTOR_ID?.trim();
 if(config.state!=='configured'||!actorId)throw new Error('VALIDATE_LINKS_NOT_CONFIGURED');
 const options={max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,statement_timeout:15000};
 const ca=process.env.JUYU_DATABASE_CA_CERT;
 const runtime=new Pool({...options,...databasePoolOptions(config.runtime,ca)});
 const issuer=new Pool({...options,...databasePoolOptions(config.issuer,ca)});
 try{
  const account=await new MemberStore(issuer).account(actorId);
  if(account.status!=='ready'||!canManage(account.viewer))throw new Error('VALIDATE_LINKS_ADMIN_REQUIRED');
  const database=new ScopedDatabase(runtime,issuer);
  const publications=await database.run(account.viewer,async client=>(await client.query<PublicationLinkSource>(`
    SELECT d.id,d.kind,d.slug,d.locale,r.title,r.description,r.body,r.revision_id AS revision
    FROM juyu.documents d
    JOIN juyu.revisions r ON r.document_id=d.id AND r.revision_id=d.published_revision_id
    WHERE d.lifecycle='active' AND juyu.can_read_revision(d.id,r.revision_id)
    ORDER BY d.kind COLLATE "C",d.id COLLATE "C"
  `)).rows,true);
  const routes=publicationLinkScanOptions(publications);
  const scanned=await scanURLs({preset:'next',...routes});
  const results=await validateFiles(publications.map(publicationLinkFile),{
   scanned,
   checkRelativePaths:'as-url',
  });
  printErrors(results,true);
  console.log(`Validated ${publications.length} published documents.`);
 }finally{
  await Promise.allSettled([runtime.end(),issuer.end()]);
 }
}

main().catch(error=>{
 const message=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'VALIDATE_LINKS_FAILED';
 console.error(message);
 process.exitCode=1;
});
