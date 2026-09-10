import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function storageFixture() {
  const directory=await mkdtemp(join(tmpdir(),'juyu-storage-test-'));
  let isPublic=false, reads=0, tailDelay=0, exists=true;
  let deleteStatus=200, verificationStatus=0, retainDeleted=false;
  let verificationBody="";
  let missingBucketStatus=404, missingBucketBody="";
  const server=createServer(async(req,res)=>{
    try {
      if(req.headers.authorization!=='Bearer test-only-key'){res.writeHead(401).end();return;}
      if(req.url==='/storage/v1/bucket' && req.method==='POST'){
        const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
        const bucket=JSON.parse(Buffer.concat(chunks).toString());
        if(bucket.id!=='juyu-private'||bucket.public!==false||exists){res.writeHead(400).end();return;}
        exists=true;isPublic=false;res.end('{}');return;
      }
      if(req.url==='/storage/v1/bucket/juyu-private' && !exists){res.writeHead(missingBucketStatus).end(missingBucketBody);return;}
      if(req.url==='/storage/v1/bucket/juyu-private'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'juyu-private',public:isPublic}));return;}
      if(req.url==='/storage/v1/object/juyu-private' && req.method==='DELETE'){
        if(deleteStatus!==200){res.writeHead(deleteStatus).end();return;}
        const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
        const {prefixes}=JSON.parse(Buffer.concat(chunks).toString());
        if(!Array.isArray(prefixes)||prefixes.some(key=>typeof key!=='string'||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(key))){res.writeHead(400).end();return;}
        if(!retainDeleted)for(const key of prefixes)await rm(join(directory,key),{force:true});
        res.setHeader('Content-Type','application/json');res.end('[]');return;
      }
      const match=/^\/storage\/v1\/object\/(?:authenticated\/)?juyu-private\/([a-f0-9-]{36})$/.exec(req.url??'');
      if(!match){res.writeHead(404).end();return;}
      const file=join(directory,match[1]);
      if(req.method==='POST'){
        const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
        await writeFile(file,Buffer.concat(chunks),{flag:'wx'});res.writeHead(200).end('{}');return;
      }
      reads++;
      if(verificationStatus){res.writeHead(verificationStatus,{"Content-Type":"application/json"}).end(verificationBody);return;}
      const bytes=await readFile(file);let start=0,end=bytes.length-1;
      if(req.headers.range){const range=/^bytes=(\d+)-(\d+)$/.exec(req.headers.range);if(!range){res.writeHead(416).end();return;}start=Number(range[1]);end=Number(range[2]);res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);}
      res.setHeader('Content-Length',end-start+1);res.setHeader('Cache-Control','public,max-age=3600');res.setHeader('Content-Type','text/html');
      const output=bytes.subarray(start,end+1);
      if(tailDelay && output.length>1){res.write(output.subarray(0,1));setTimeout(()=>res.end(output.subarray(1)),tailDelay);}else res.end(output);
    } catch {res.writeHead(404).end();}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('No port');
  return {setMissingBucketResponse(status:number,body:string){missingBucketStatus=status;missingBucketBody=body;},url:`http://127.0.0.1:${address.port}`,directory,get reads(){return reads;},setDeleteStatus(value:number){deleteStatus=value;},setVerificationStatus(value:number){verificationStatus=value;verificationBody="";},setVerificationResponse(status:number,body:string){verificationStatus=status;verificationBody=body;},setRetainDeleted(value:boolean){retainDeleted=value;},setExists(value:boolean){exists=value;},setPublic(value:boolean){isPublic=value;},setTailDelay(value:number){tailDelay=value;},async close(){await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await rm(directory,{recursive:true,force:true});}};
}
