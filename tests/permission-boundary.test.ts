import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AuthorizationService} from '../src/server/authorization/service.ts';
import type {Viewer} from '../src/domain/model.ts';

// Administrative operations must refuse employees before opening any transaction,
// even when their body claims to be an administrator or assigned second reviewer.
const forged={role:'admin',memberId:'other-admin',reviewerId:'other-admin',companyVerified:true,expectedSequence:0};
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const adminCalls:Record<string,unknown[]>={
 announcements:[true],saveAnnouncement:[id,forged],settingHistory:[],settingHistoryDetail:[forged],restoreSetting:[forged],
 featureConfig:[],saveFeatureConfig:[forged],navigationSettings:[],saveNavigationSettings:[forged],
 forms:[true],form:[id,true],saveForm:[id,forged],formRecords:[],formRecord:[id],processFormRecord:[id,forged],
 categories:[],saveCategory:[id,forged],fields:[],saveField:[id,forged],analyticsDashboard:[],
 deletedHistory:[],history:[id],historyVersion:[id,1],restoreVersion:[id,forged],historyAsset:[id,1,id],
 availabilityDetail:[id],changeAvailability:[id,forged],archives:[],publicationDetail:[id],changePublication:[id,forged],
 controlReviewDetail:[id],changeReviewControl:[id,forged],reviewDetail:[id],decideReview:[id,forged],reviewers:[id],submitReview:[id,forged],
 trash:[],lifecycle:[id,forged],cleanupJobs:[id],startCleanupAttempt:[id,id],cleanupPending:[id],finishCleanup:[id,id],
 feedbackOverview:[],feedbackDetails:[id,1],workspace:[],mediaDocuments:[],requireEditorAdmin:[],editor:[id],saveDraft:[id,forged],
 media:[id],saveMedia:[id,forged],reserveUpload:[id,id,forged],finishUpload:[id,true],managementAsset:[id],management:[id],reusableFragments:[],createReusableFragment:[forged],updateReusableFragment:[id,1,forged],
};
for(const role of ['support','ops'] as const)test(`T055 ${role} cannot invoke any of ${Object.keys(adminCalls).length} administrative operations`,async()=>{
 let transactions=0;
 const s=new AuthorizationService({async run(){transactions++;throw new Error('UNEXPECTED_DATABASE_ACCESS');}},async()=>({id:'employee',role,companyVerified:true}));
 for(const [name,args] of Object.entries(adminCalls)){
  const fn=Reflect.get(s,name);assert.equal(typeof fn,'function',name);
  await assert.rejects(Reflect.apply(fn,s,args),/FORBIDDEN/,name);
 }
 assert.equal(transactions,0);
});

test('T055 anonymous, unverified and invalid-role identities cannot read even previously known object IDs',async()=>{
 const identities:unknown[]=[null,{id:'member',role:'admin',companyVerified:false},{id:'member',role:'owner',companyVerified:true},{id:' ',role:'admin',companyVerified:true}];
 for(const viewer of identities){
  const s=new AuthorizationService({async run(){throw new Error('UNEXPECTED_DATABASE_ACCESS');}},async()=>viewer as Viewer|null);
  for(const [name,args] of Object.entries({reader:[id],article:[id],articleVersion:[id],changelog:[1],search:['secret'],asset:[id],pdf:[id,1],favorites:[],recent:[],readerMenu:[],forms:[],announcements:[]}))
   await assert.rejects(Reflect.apply(Reflect.get(s,name),s,args),/FORBIDDEN/,name);
 }
});
