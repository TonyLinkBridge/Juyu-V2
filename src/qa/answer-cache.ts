// Browser memory only. No private answers are written to persistent storage.
export function createAnswerCache<T>(ttl=30_000,limit=50){
 const values=new Map<string,{value:T;expires:number}>();
 const key=(scope:string,id:string,revision:number|undefined)=>JSON.stringify([scope,id,revision]);
 return {
  get(scope:string,id:string,revision:number|undefined,now=Date.now()):T|undefined{
   const k=key(scope,id,revision),entry=values.get(k);
   if(!entry||entry.expires<=now)return undefined;return entry.value;
  },
  peek(scope:string,id:string,revision:number|undefined):T|undefined{
   return values.get(key(scope,id,revision))?.value;
  },
  put(scope:string,id:string,revision:number|undefined,value:T,now=Date.now()){
   const k=key(scope,id,revision);values.delete(k);values.set(k,{value,expires:now+ttl});
   while(values.size>limit)values.delete(values.keys().next().value!);
  },
  clear(){values.clear();}
 };
}
