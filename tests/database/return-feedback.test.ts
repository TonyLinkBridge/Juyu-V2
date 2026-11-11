import assert from 'node:assert/strict';
import {test} from 'node:test';
import {discardDatabase} from '../helpers/discard-database.ts';

for(const boundary of ['direct_publish','discard_draft'] as const)test(`a new draft after ${boundary} does not revive resolved feedback`,async()=>{
 const h=await discardDatabase();try{
  const {draft}=await h.workingDraft('super_admin'),id=draft.id;
  await h.service(h.author).submitReview(id,{expectedSequence:draft.sequence,reviewerId:h.reviewer.id});
  await h.service(h.reviewer).decideReview(id,{expectedSequence:draft.sequence+1,action:'reject',reason:'这一轮需要补充'});
  const editor=boundary==='direct_publish'?h.superAdmin:h.author;
  let d=await h.repo.execute(id,{type:'edit',title:'已处理审核意见',body:'修订内容',audience:'staff'},editor,{expectedSequence:draft.sequence+2});
  assert.equal((await h.service(editor).editor(id)).returnFeedback?.reason,'这一轮需要补充');
  if(boundary==='direct_publish')await h.service(h.superAdmin).changePublication(id,{action:'direct_publish',expectedSequence:d.sequence});
  else await h.service(h.author).discardDraft(id,{expectedSequence:d.sequence});
  d=(await h.repo.getForManagement(id,h.author))!;
  await h.repo.execute(id,{type:'edit',title:'另一轮的新草稿',body:'新修改',audience:'staff'},h.author,{expectedSequence:d.sequence});
  assert.equal((await h.service(h.author).editor(id)).returnFeedback,null);
  assert.equal((await h.fixture.pool.query("SELECT reason FROM juyu.reviews WHERE document_id=$1 AND status='rejected'",[id])).rows[0].reason,'这一轮需要补充','history remains intact');
 }finally{await h.close();}
});
