import {useSyncExternalStore} from 'react';
const params=new URLSearchParams(location.search);
const subscribers=new Set();
let attempts=0;
const profileFixture=params.has('onboarding');
let snapshot={isLoaded:!params.has('loading')&&!profileFixture,isSignedIn:!params.has('signed-out'),user:null};
const user={
 id:params.get('user')||'user_local_qa',fullName:'Haley QA',
 publicMetadata:{role:params.get('role')||'super_admin'},
 primaryEmailAddress:{emailAddress:'haley-qa@example.test'},imageUrl:'/__missing-avatar',
 unsafeMetadata:profileFixture?{}:{juyu_onboarding:{employee:{version:1,status:'completed'},admin:{version:1,status:'completed'}}},
 async updateMetadata(payload){
  const response=await fetch('/__guide-metadata?user='+encodeURIComponent(user.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!response.ok)throw new Error('METADATA_OFFLINE');
  user.unsafeMetadata=(await response.json()).unsafeMetadata;
  publish();return user;
 },
};
snapshot={...snapshot,user};
function publish(){snapshot={...snapshot,user};for(const subscriber of subscribers)subscriber();}
if(profileFixture&&!params.has('loading')&&!params.has('signed-out')){
 void fetch('/__guide-metadata?user='+encodeURIComponent(user.id)).then(async response=>{
  if(!response.ok)throw new Error('PROFILE_OFFLINE');
  user.unsafeMetadata=(await response.json()).unsafeMetadata;snapshot={...snapshot,isLoaded:true};publish();
 });
}
export const useUser=()=>useSyncExternalStore(callback=>{subscribers.add(callback);return()=>subscribers.delete(callback);},()=>snapshot,()=>snapshot);
export const ClerkFailed=({children})=>params.has('provider-failed')?children:null;
export const ClerkLoading=({children})=>params.has('loading')?children:null;
export const useSession=()=>({isLoaded:!params.has('loading'),session:params.has('no-session')?null:{id:'sess_local_qa'}});
export const useClerk=()=>({
 openUserProfile:()=>{if(params.has('profile-fails'))throw new Error('PROFILE_OFFLINE');document.getElementById('profile-result').textContent='账号设置已打开';},
 signOut:async options=>{attempts++;document.getElementById('logout-result').textContent=JSON.stringify({attempts,options});if(params.has('delay'))await new Promise(resolve=>setTimeout(resolve,250));if(params.has('logout-fails')&&attempts===1)throw new Error('OFFLINE');document.getElementById('logout-success').textContent='已退出测试会话';},
});
