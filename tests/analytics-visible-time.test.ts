import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analyticsInput} from '../src/analytics/model.ts';
const ids={eventId:'bfa6a392-2f55-4a5e-ad67-772758f18bdb',viewId:'cfa6a392-2f55-4a5e-ad67-772758f18bdb',documentId:'article',revision:2};
test('cumulative visible time reports validate strictly and preserve original visit identity',()=>{
 assert.deepEqual(analyticsInput({kind:'view_time',...ids,visibleMs:12000}),{kind:'view_time',...ids,visibleMs:12000});
 for(const visibleMs of [-1,1.1,'1200',43200001,null])assert.throws(()=>analyticsInput({kind:'view_time',...ids,visibleMs}),/INVALID_INPUT/);
 assert.throws(()=>analyticsInput({kind:'view_time',...ids,visibleMs:12,memberId:'other'}),/INVALID_INPUT/);
});

import {VisibleTimeClock} from '../src/analytics/visible-time.ts';
import {peopleQuery} from '../src/analytics/dashboard.ts';
import {visibleDuration} from '../src/analytics/dashboard-format.ts';
test('people filters reject coercible objects and missing timing is distinct from a measured zero',()=>{
 for(const page of [[1],true,{toString:()=> '1'},'01',0])assert.throws(()=>peopleQuery({page}),/INVALID_INPUT/);
 assert.deepEqual(peopleQuery({days:'7',page:'2'}),{days:7,page:2,documentId:undefined});
 assert.equal(visibleDuration(null),'未记录');assert.equal(visibleDuration(0),'0秒');assert.equal(visibleDuration(138000),'2分18秒');
});
test('visible clock pauses hidden tabs and caps suspended browser gaps',()=>{
 const clock=new VisibleTimeClock();clock.setVisible(true,100);assert.equal(clock.sample(5100),5000);
 clock.setVisible(false,10100);assert.equal(clock.sample(50100),10000);
 clock.setVisible(true,60100);assert.equal(clock.sample(65100),15000);
 assert.equal(clock.sample(365100),45000);assert.equal(clock.sample(365100),45000);
});
