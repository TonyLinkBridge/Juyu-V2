/** The server explicitly rejected the write; its payload may be corrected. */
export class DraftSaveRejected extends Error {name='DraftSaveRejected';}

/** One request at a time. Acknowledging an older edit never clears newer unsaved input. */
export class DraftSaver<T,R extends {sequence:number}> {
 private value:T;private savedSignature:string;private send:(value:T,sequence:number|null)=>Promise<R>;
 private pending:{value:T;signature:string;sequence:number|null}|null=null;
 private changed:()=>void;private saved:(result:R)=>void;
 state:{sequence:number|null;dirty:boolean;busy:boolean;error:string;blocked:boolean};
 constructor(initial:T,sequence:number|null,send:(value:T,sequence:number|null)=>Promise<R>,changed:()=>void,saved:(result:R)=>void){
  this.value=structuredClone(initial);this.savedSignature=JSON.stringify(initial);this.send=send;this.changed=changed;this.saved=saved;
  this.state={sequence,dirty:false,busy:false,error:'',blocked:false};
 }
 update(value:T){this.value=structuredClone(value);this.state.dirty=this.pending!==null||JSON.stringify(value)!==this.savedSignature;this.changed();}
 async save(retry=false){
  if(this.state.busy||!this.state.dirty||(this.state.blocked&&!retry))return;
  // An error can mean the server committed but its response was lost. Retain
  // that exact payload and sequence until acknowledged, even after more typing.
  this.pending??={value:structuredClone(this.value),signature:JSON.stringify(this.value),sequence:this.state.sequence};
  const {value,signature,sequence}=this.pending;
  this.state.busy=true;this.state.error='';this.changed();
  try{const result=await this.send(structuredClone(value),sequence);
   if(!Number.isSafeInteger(result.sequence)||result.sequence!==(sequence===null?0:sequence+1))throw new Error('INVALID_ACK');
   this.pending=null;this.state.sequence=result.sequence;this.savedSignature=signature;this.state.dirty=JSON.stringify(this.value)!==signature;this.state.blocked=false;this.saved(result);
  }catch(e){
   if(e instanceof DraftSaveRejected)this.pending=null;
   this.state.error=e instanceof Error?e.message:'SAVE_FAILED';this.state.blocked=true;
  }
  finally{this.state.busy=false;this.changed();}
 }
}
