import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseFieldWrite,normalizeFieldSnapshots,prepareFieldSnapshots,validateFieldSnapshots,type FieldDefinition} from '../src/fields/model.ts';
const field:FieldDefinition={id:'00000000-0000-4000-8000-000000000001',version:1,name:'日期',type:'date',options:[],required:true,enabled:true};
test('field definition input is exact and validates bounds and types',()=>{
 const input={expectedVersion:null,name:' 名称 ',type:'text',options:[],required:false,enabled:true};assert.equal(parseFieldWrite(input).name,'名称');
 for(const patch of [{name:''},{name:'a'.repeat(81)},{extra:true},{type:'html'},{required:1},{expectedVersion:0},{options:['bad']},{type:'select',options:[]},{type:'select',options:['a',' a ']},{type:'select',options:['a'.repeat(81)]}])assert.throws(()=>parseFieldWrite({...input,...patch}),/INVALID_INPUT/);
});
test('snapshots retain historic labels and null while active validation enforces real dates required and exact definitions',()=>{
 assert.deepEqual(normalizeFieldSnapshots(undefined),[]);assert.deepEqual(normalizeFieldSnapshots([{...field,value:null}]),[{...field,value:null}]);
 for(const value of [null,'0000-01-01','2026-02-29','2026-13-01','2026-2-01',false,3])assert.throws(()=>validateFieldSnapshots([field],[{...field,value}]),/INVALID_INPUT/);
 assert.deepEqual(validateFieldSnapshots([field],[{...field,value:'2024-02-29'}]),[{...field,value:'2024-02-29'}]);
 for(const patch of [{version:2},{name:'Fake'},{options:['x']},{required:false},{enabled:false}])assert.throws(()=>validateFieldSnapshots([field],[{...field,value:'2024-02-29',...patch}]),/INVALID_INPUT|FIELD_CONFLICT/);
 assert.throws(()=>validateFieldSnapshots([field],[]),/INVALID_INPUT/);
});
test('typed values preserve false and zero and prevent invalid select numeric and oversized text values',()=>{
 for(const [type,value] of [['boolean',false],['number',0],['text','答复'],['select','A']] as const){const d={...field,type,options:type==='select'?['A']:[]};assert.equal(validateFieldSnapshots([d],[{...d,value}])[0].value,value);}
 for(const [type,value] of [['number',NaN],['number',Infinity],['number','1'],['boolean','false'],['text','x'.repeat(2001)],['text',' '],['select','B']] as const){const d={...field,type,options:type==='select'?['A']:[]};assert.throws(()=>validateFieldSnapshots([d],[{...d,value}]),/INVALID_INPUT/);}
});
test('prepare reconciles enabled definitions but preserves disabled snapshots exactly',()=>{
 const saved={...field,value:'2024-02-29'};const updated={...field,version:2,name:'新日期'};
 assert.deepEqual(prepareFieldSnapshots([updated],[saved]),[{...updated,value:saved.value}]);
 const disabled={...updated,enabled:false};assert.deepEqual(prepareFieldSnapshots([disabled],[saved]),[saved]);assert.deepEqual(validateFieldSnapshots([disabled],[saved],[saved]),[saved]);
 for(const snapshots of [[],[{...saved,value:null}],[{...disabled,value:saved.value}]])assert.throws(()=>validateFieldSnapshots([disabled],snapshots,[saved]),/INVALID_INPUT/);
 assert.throws(()=>validateFieldSnapshots([], [saved]),/INVALID_INPUT/);assert.throws(()=>normalizeFieldSnapshots([saved,saved]),/INVALID_INPUT/);
});
test('stale enabled definition versions report a recoverable configuration conflict',()=>{
 assert.throws(()=>validateFieldSnapshots([{...field,version:2}],[{...field,value:'2024-02-29'}]),/FIELD_CONFLICT/);
});
