/** Only the active review page registers a guard; no request payload is stored here. */
export type ReviewLeaveIntent='navigate'|'discard'|'signout';
type Guard={check:(intent:ReviewLeaveIntent)=>Promise<boolean>;commit:()=>void;reset:()=>void};
let current:Guard|undefined;
export function registerReviewLeaveGuard(guard:Guard){current=guard;return ()=>{if(current===guard)current=undefined;};}
export async function requestReviewLeave(intent:ReviewLeaveIntent='navigate'){
 const guard=current;if(!guard)return true;
 const allowed=await guard.check(intent);
 if(!allowed||current!==guard)return false;
 if(intent==='signout')guard.commit();
 return true;
}
export function resetReviewLeave(){current?.reset();}
