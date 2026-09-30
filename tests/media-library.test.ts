import assert from 'node:assert/strict';import {test} from 'node:test';
import {libraryQuery,libraryHref,fileCategory,formatBytes} from '../src/media/library.ts';
test('file filters and search query roundtrip without losing selected scope',()=>{
 const query=libraryQuery({q:'image_%',type:'image',sort:'name',page:'2',view:'list'});
 assert.equal(query.page,2);assert.equal(libraryHref(query,{file:'selected'}),'/admin/media?q=image_%25&type=image&sort=name&page=2&view=list&file=selected');
 assert.equal(fileCategory('audio/ogg'),'audio');assert.equal(fileCategory('application/pdf'),'file');assert.equal(formatBytes('248000'),'242 KB');
});
test('library rejects repeated and invalid query inputs rather than broadening asset scope',()=>{
 for(const query of [{q:['one','two']},{page:'0'},{sort:'sql'},{type:'invalid'},{file:'not-uuid'},{q:'x'.repeat(121)}])assert.throws(()=>libraryQuery(query),/INVALID_INPUT/);
});
