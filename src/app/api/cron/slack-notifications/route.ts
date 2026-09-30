import {timingSafeEqual} from 'node:crypto';
import {deliverSlackNotifications} from '../../../../server/slack/service';

export const dynamic='force-dynamic';
export const maxDuration=60;

function validSecret(value:string|null,secret:string|undefined){
 if(!secret||secret.length<16||!value?.startsWith('Bearer '))return false;
 const actual=Buffer.from(value.slice(7));
 const expected=Buffer.from(secret);
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

export async function GET(request:Request){
 const authorization=request.headers.get('authorization');
 if(!validSecret(authorization,process.env.CRON_SECRET)){
  if(request.headers.get('user-agent')==='vercel-cron/1.0'){
   const secret=process.env.CRON_SECRET;
   const supplied=authorization?.startsWith('Bearer ')?authorization.slice(7):null;
   console.error('SLACK_CRON_AUTH_REJECTED',{
    configured:Boolean(secret),minimumLength:(secret?.length??0)>=16,
    bearerHeader:supplied!==null,sameLength:supplied!==null&&supplied.length===secret?.length,
   });
  }
  return new Response('Unauthorized',{status:401});
 }
 try{
  const result=await deliverSlackNotifications(5);
  if(!result.configured)return Response.json({error:'SLACK_NOT_CONFIGURED'},{status:503});
  return Response.json({sent:result.sent,failed:result.failed});
 }catch{
  console.error('SLACK_DELIVERY_FAILED');
  return Response.json({error:'SLACK_DELIVERY_FAILED'},{status:503});
 }
}
