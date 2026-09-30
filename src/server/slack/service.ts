import 'server-only';
import {applicationDatabase} from '../database/application.ts';
import {dispatchSlackOutbox} from './dispatch.ts';

export async function deliverSlackNotifications(limit=1){
 const token=process.env.SLACK_BOT_TOKEN;
 const channel=process.env.SLACK_NOTIFICATION_CHANNEL_ID;
 const origin=process.env.APP_ORIGIN;
 if(!token||!channel||!origin)return {sent:0,failed:0,configured:false};
 const {notificationPool}=applicationDatabase();
 const result=await dispatchSlackOutbox(notificationPool,{token,channel,origin},limit);
 return {...result,configured:true};
}

export async function deliverSlackNotificationsSafely(){
 try{await deliverSlackNotifications();}
 catch{console.error('SLACK_DELIVERY_FAILED');}
}
