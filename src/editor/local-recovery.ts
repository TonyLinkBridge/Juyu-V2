/** Opt-in device copies. Keys isolate accounts, but browser storage is not encrypted. */
export const RECOVERY_PREFIX='juyu:editor-recovery:v1:';
export const RECOVERY_TTL=24*60*60*1000;
const key=(owner:string,id:string)=>RECOVERY_PREFIX+encodeURIComponent(owner)+':'+encodeURIComponent(id);
export type LocalCopy={owner:string;id:string;at:number;sequence:number|null;text:string};
export function readLocalCopy(store:Storage,owner:string,id:string,now=Date.now()):LocalCopy|null{
 const k=key(owner,id),raw=store.getItem(k);if(!raw)return null;
 try{const v=JSON.parse(raw) as LocalCopy;if(v.owner!==owner||v.id!==id||!Number.isFinite(v.at)||v.at>now||now-v.at>RECOVERY_TTL||typeof v.text!=='string'||v.text.length>2_000_000||!(v.sequence===null||Number.isSafeInteger(v.sequence)))throw Error();return v;}catch{store.removeItem(k);return null;}
}
export function writeLocalCopy(store:Storage,copy:LocalCopy){if(!copy.owner||copy.text.length>2_000_000)throw Error('RECOVERY_LIMIT');store.setItem(key(copy.owner,copy.id),JSON.stringify(copy));if(copy.sequence===null){const kind=JSON.parse(copy.text).kind;if(['article','ops','qa','reference'].includes(kind))store.setItem(key(copy.owner,'new-'+kind),copy.id);}}
export function removeLocalCopy(store:Storage,owner:string,id:string){store.removeItem(key(owner,id));}
export function recoveryEnabled(store:Storage,owner:string){return !!owner&&store.getItem(key(owner,'enabled'))==='yes';}
export function enableRecovery(store:Storage,owner:string){store.setItem(key(owner,'enabled'),'yes');}
export function clearDeviceRecovery(store:Storage){for(let i=store.length-1;i>=0;i--){const k=store.key(i);if(k?.startsWith(RECOVERY_PREFIX))store.removeItem(k);}}
export function newRecoveryId(store:Storage,owner:string,kind:string):string{
 if(!recoveryEnabled(store,owner))return crypto.randomUUID();
 const pointer=key(owner,'new-'+kind),id=store.getItem(pointer);if(id&&readLocalCopy(store,owner,id))return id;
 const next=crypto.randomUUID();store.setItem(pointer,next);return next;
}

export function pruneDeviceRecovery(store:Storage,now=Date.now()){
 for(let i=store.length-1;i>=0;i--){const k=store.key(i);if(!k?.startsWith(RECOVERY_PREFIX))continue;const raw=store.getItem(k);if(!raw?.startsWith('{'))continue;try{const v=JSON.parse(raw);if(!Number.isFinite(v.at)||v.at>now||now-v.at>RECOVERY_TTL)store.removeItem(k);}catch{store.removeItem(k);}}
}
