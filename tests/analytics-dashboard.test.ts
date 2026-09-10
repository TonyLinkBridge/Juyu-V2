import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rangeDays} from '../src/analytics/dashboard.ts';
test('dashboard range defaults only when omitted and accepts exactly the supported numeric or string values',()=>{
 assert.equal(rangeDays(),30);assert.equal(rangeDays(undefined),30);
 for(const days of [7,30,90] as const){assert.equal(rangeDays(days),days);assert.equal(rangeDays(String(days)),days);}
});
test('dashboard rejects ambiguous, coerced and unsupported ranges',()=>{
 for(const input of [null,'',' 7','7 ','07','7.0','30,90',0,1,8,-7,7.1,NaN,Infinity,true,false,[],[7],['30'],{},new Number(7),new String('30')])assert.throws(()=>rangeDays(input),/INVALID_INPUT/);
});
