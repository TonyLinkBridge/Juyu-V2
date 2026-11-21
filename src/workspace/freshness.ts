// A browser-local signal only. Each tab still reads the authorized workspace
// from the server, using its own filters and session.
export const workspaceChangeKey='juyu-workspace-changed';
let lastChange=0;

export function notifyWorkspaceChange(){
 if(typeof window==='undefined')return;
 lastChange=Date.now();
 try{window.localStorage.setItem(workspaceChangeKey,`${lastChange}:${Math.random()}`);}catch{/* Storage may be disabled. */}
}

export function workspaceChangedSinceLoad(){
 let stored=0;
 try{stored=Number(window.localStorage.getItem(workspaceChangeKey)?.split(':')[0])||0;}catch{/* Storage may be disabled. */}
 return Math.max(lastChange,stored)>=window.performance.timeOrigin;
}
