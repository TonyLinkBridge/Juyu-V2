/** Operator-only, disposable file drill on the named T060 recovery project. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import {SupabasePrivateStorage} from '../src/server/storage/supabase.ts';
import {backupFiles,restoreFiles} from '../src/server/storage/backup.ts';
const env=parseEnv(await readFile('.env.local','utf8'));
assert.ok(env.JUYU_RECOVERY_SUPABASE_SERVICE_ROLE_KEY,'MISSING_RECOVERY_STORAGE_KEY');
const origin='https://bgrvonvrytlaufityutq.supabase.co';
assert.notEqual(origin,env.NEXT_PUBLIC_SUPABASE_URL,'REFUSE_PRODUCTION');
const store=new SupabasePrivateStorage(origin,env.JUYU_RECOVERY_SUPABASE_SERVICE_ROLE_KEY);
const id=randomUUID(), bytes=Buffer.from('Disposable T060 cloud file recovery sample.\n'.repeat(1024));
const asset={id,object_key:id,document_id:'t060-disposable-storage-drill',bucket:'juyu-private',filename:'t060-disposable.txt',mime_type:'text/plain',byte_size:bytes.length};
const work=await mkdtemp(join(tmpdir(),'juyu-t060-media-'));
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
let created=false;
try {
 await store.provisionPrivateBucket();
 await store.put(id,new Blob([bytes]).stream(),asset.mime_type); created=true;
 await backupFiles(store,[asset],join(work,'media'));
 await assert.rejects(restoreFiles(store,join(work,'media'))); // Existing destination cannot be overwritten.
 assert.equal(hash(Buffer.from(await (await store.read(id)).arrayBuffer())),hash(bytes));
 await store.remove(id); // Only the UUID created by this invocation, never pre-existing files.
 await assert.rejects(store.read(id),/PRIVATE_OBJECT_UNAVAILABLE/);
 const started=Date.now();
 await restoreFiles(store,join(work,'media'));
 assert.equal(hash(Buffer.from(await (await store.read(id)).arrayBuffer())),hash(bytes));
 const restoreMs=Date.now()-started;
 const anonymous=await fetch(origin+'/storage/v1/object/public/juyu-private/'+id,{signal:AbortSignal.timeout(15000)});
 assert.equal(anonymous.ok,false,'PUBLIC_FILE_EXPOSURE');await anonymous.body?.cancel();
 await writeFile(join(work,'media',id),'corrupt');
 await assert.rejects(restoreFiles(store,join(work,'media')),/BACKUP_INTEGRITY/);
 assert.equal(hash(Buffer.from(await (await store.read(id)).arrayBuffer())),hash(bytes));
 await store.remove(id);created=false;
 await mkdir('output/verification',{recursive:true});
 const report={createdAt:new Date().toISOString(),project:'bgrvonvrytlaufityutq',bytes:bytes.length,sha256:hash(bytes),restoreMs,anonymousStatus:anonymous.status,checks:['real cloud upload','backup','overwrite refused','disposable original removed','restore and readback hash matched','anonymous denied','corrupt backup refused','disposable object removed'],scope:'Synthetic file in real recovery project; production attachment inventory empty'};
 await writeFile('output/verification/t060-cloud-media.json',JSON.stringify(report,null,2),{mode:0o600});
 console.log(JSON.stringify(report));
} catch(error){console.error(error instanceof Error?error.message:'MEDIA_DRILL_FAILED');process.exitCode=1;}
finally{if(created)await store.remove(id).catch(()=>console.error('TEST_OBJECT_CLEANUP_REQUIRED: '+id));await rm(work,{recursive:true,force:true});}
