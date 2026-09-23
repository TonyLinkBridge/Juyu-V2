import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationInput} from '../src/review/publication.ts';

test('direct publication accepts only the exact sequence, action and optional English confirmation',()=>{
 assert.deepEqual(publicationInput({expectedSequence:4,action:'direct_publish'}),{expectedSequence:4,action:'direct_publish'});
 assert.deepEqual(publicationInput({expectedSequence:4,action:'direct_publish',englishQualityConfirmed:true}),{expectedSequence:4,action:'direct_publish',englishQualityConfirmed:true});
 for(const value of [
  {expectedSequence:4,action:'direct_publish',reason:'x'},
  {expectedSequence:4,action:'direct_publish',englishQualityConfirmed:false},
  {expectedSequence:4,action:'queue',englishQualityConfirmed:true},
 ])assert.throws(()=>publicationInput(value),/INVALID_INPUT/);
});
