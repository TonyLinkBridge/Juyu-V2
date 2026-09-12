import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerReviewLeaveGuard,requestReviewLeave,resetReviewLeave} from '../src/review/leave.ts';
test('normal logout without a review page remains allowed',async()=>{assert.equal(await requestReviewLeave('signout'),true);});
test('cancelled logout does not commit; confirmed logout commits and failed logout can reset protection',async()=>{
 let allow=false,commits=0,resets=0;
 const dispose=registerReviewLeaveGuard({check:async intent=>{assert.equal(intent,'signout');return allow;},commit:()=>{commits++;},reset:()=>{resets++;}});
 try{assert.equal(await requestReviewLeave('signout'),false);assert.equal(commits,0);allow=true;assert.equal(await requestReviewLeave('signout'),true);assert.equal(commits,1);resetReviewLeave();assert.equal(resets,1);}finally{dispose();}
});
test('stale confirmation cannot authorize logout from a replaced review page',async()=>{
 let release!:(v:boolean)=>void;let commits=0;
 const old=registerReviewLeaveGuard({check:()=>new Promise<boolean>(r=>{release=r;}),commit:()=>{commits++;},reset:()=>{}});
 const pending=requestReviewLeave('signout');
 const current=registerReviewLeaveGuard({check:async()=>false,commit:()=>{commits++;},reset:()=>{}});
 old();release(true);assert.equal(await pending,false);assert.equal(await requestReviewLeave('signout'),false);assert.equal(commits,0);current();
});
