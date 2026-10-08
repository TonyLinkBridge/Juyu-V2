import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyticsRange,analyticsRangeParams,peopleQuery} from '../src/analytics/dashboard.ts';
import {dashboardQuery} from '../src/server/analytics/dashboard-http.ts';
import {libraryQuery,libraryHref,libraryOrder} from '../src/media/library.ts';
import {validateMediaFile,MediaUploadError,uploadMediaFile} from '../src/media/upload-client.ts';
const now=new Date('2026-10-08T16:10:00Z');
test('calendar range includes whole selected days in UTC+8, not browser UTC',()=>{
 const range=analyticsRange({from:'2026-10-01',to:'2026-10-02'},now);
 assert.deepEqual(range,{days:2,from:'2026-10-01',to:'2026-10-02',start:'2026-09-30T16:00:00.000Z',end:'2026-10-02T16:00:00.000Z'});
 assert.equal(analyticsRangeParams({from:'2026-10-01',to:'2026-10-02'}).toString(),'from=2026-10-01&to=2026-10-02');
 assert.equal(analyticsRangeParams(7).toString(),'days=7');
 assert.equal(analyticsRange({from:'2024-02-29',to:'2024-02-29'},now).days,1);
});
test('date validation rejects impossible, reversed, partial, future and over 90 day ranges',()=>{
 for(const input of [{from:'2025-02-29',to:'2025-03-01'},{from:'2026-10-02',to:'2026-10-01'},{from:'2026-10-01'},{from:'2026-10-01',to:'2026-10-10'},{from:'2026-01-01',to:'2026-04-01'},{from:'2026-1-01',to:'2026-01-02'},{from:'2026-01-01',to:'2026-01-02',days:7}])assert.throws(()=>analyticsRange(input,now),/INVALID_INPUT/);
});
test('dashboard and employee detail accept identical dates and reject mixed or repeated parameters',()=>{
 const dates={from:'2026-09-01',to:'2026-09-03'};
 assert.deepEqual(dashboardQuery(new URL('http://local/?from=2026-09-01&to=2026-09-03')),dates);
 const people=peopleQuery({...dates,page:'2',documentId:'article'});assert.equal(people.days,3);assert.equal(people.from,dates.from);assert.equal(people.to,dates.to);assert.equal(people.page,2);
 for(const query of ['?from=2026-09-01','?from=2026-09-01&to=2026-09-02&days=7','?from=2026-09-01&from=2026-09-01&to=2026-09-02'])assert.throws(()=>dashboardQuery(new URL('http://local/'+query)),/INVALID_INPUT/);
 assert.throws(()=>peopleQuery({...dates,days:7}),/INVALID_INPUT/);
});
test('media server sort is directional and stable before pagination and URL retains its scope',()=>{
 const query=libraryQuery({sort:'size',direction:'asc',q:'A',type:'image',page:'3',view:'list'});
 assert.equal(libraryOrder(query),'a.byte_size ASC,a.id');
 assert.equal(libraryOrder(libraryQuery({sort:'name',direction:'desc'})),'a.filename COLLATE "C" DESC,a.id');
 assert.equal(libraryOrder(libraryQuery({})),'a.created_at DESC,a.id');
 assert.equal(libraryHref(query,{page:1,file:undefined}),'/admin/media?q=A&type=image&sort=size&direction=asc&view=list');
 assert.throws(()=>libraryQuery({direction:'drop table'}),/INVALID_INPUT/);
});
test('upload preflight rejects empty, unsupported and type-specific oversized files',()=>{
 for(const file of [{name:'x.exe',size:1},{name:'x.png',size:0},{name:'x.png',size:6*1024*1024}])assert.throws(()=>validateMediaFile(file),MediaUploadError);
 assert.doesNotThrow(()=>validateMediaFile({name:'x.mp4',size:40*1024*1024}));
});
test('transfer completion is not success until ready receipt; uncertain outcomes forbid retry',async()=>{
 let xhr:FakeXHR;class FakeXHR {
  upload={onprogress:null as null|((event:{lengthComputable:boolean;loaded:number;total:number})=>void)};onload:null|(()=>void)=null;onerror:null|(()=>void)=null;ontimeout:null|(()=>void)=null;onabort:null|(()=>void)=null;status=200;responseText='{"id":"asset","status":"ready"}';timeout=0;withCredentials=false;headers:Record<string,string>={};open(){}setRequestHeader(k:string,v:string){this.headers[k]=v;}send(){}abort(){this.onabort?.();}
 }
 const file=new File(['abc'],'x.txt');const progress:number[]=[];
 const pending=uploadMediaFile('article',file,{onProgress:value=>progress.push(value),createRequest:()=>(xhr=new FakeXHR()) as unknown as XMLHttpRequest});
 xhr!.upload.onprogress?.({lengthComputable:true,loaded:3,total:3});assert.deepEqual(progress,[99]);xhr!.onload?.();assert.equal(await pending,'asset');assert.equal(progress.at(-1),100);
 const unknown=uploadMediaFile('article',file,{createRequest:()=>(xhr=new FakeXHR()) as unknown as XMLHttpRequest});xhr!.onerror?.();await assert.rejects(unknown,error=>error instanceof MediaUploadError&&!error.retryable);
 const invalid=uploadMediaFile('article',file,{createRequest:()=>(xhr=new FakeXHR()) as unknown as XMLHttpRequest});xhr!.status=400;xhr!.responseText='{"error":"INVALID_UPLOAD"}';xhr!.onload?.();await assert.rejects(invalid,error=>error instanceof MediaUploadError&&error.retryable);
});
