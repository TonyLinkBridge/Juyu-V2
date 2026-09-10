import {test} from 'node:test';import assert from 'node:assert/strict';import {analyticsPercent} from '../src/analytics/dashboard-format.ts';
test('analytics distinguishes absent denominator from confirmed zero clicks',()=>{assert.equal(analyticsPercent(0,0),'—');assert.equal(analyticsPercent(0,4),'0%');assert.equal(analyticsPercent(1,3),'33.3%');assert.equal(analyticsPercent(4,4),'100%');});
