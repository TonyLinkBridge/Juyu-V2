import type {Integration,Telemetry} from '../../developers/model.ts';
/** Complete the identity scope before taking a worker connection from the same pool. */
export async function persistConnectionResult(result:Integration,authorize:()=>Promise<unknown>,persist:(records:Telemetry[])=>Promise<void>){
 if(!result.checkedAt)return;
 await authorize();
 await persist([{source:'connection',name:result.id,level:result.check==='failed'?'error':'info',status:result.check==='failed'?503:200,code:result.code}]);
}
