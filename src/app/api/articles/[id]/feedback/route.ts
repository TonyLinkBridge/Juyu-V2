import {applicationAuthorization} from '../../../../../server/authorization/application.ts';
import {feedbackResponse,readFeedbackInput} from '../../../../../server/feedback/http.ts';
import {positiveInteger} from '../../../../../feedback/model.ts';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 return feedbackResponse(async()=>{const service=await applicationAuthorization();const revision=positiveInteger(Number(new URL(request.url).searchParams.get('revision')));return {feedback:await service.feedback((await context.params).id,revision)};});
}
export async function PUT(request:Request,context:{params:Promise<{id:string}>}){
 return feedbackResponse(async()=>{const service=await applicationAuthorization();const input=await readFeedbackInput(request,process.env.APP_ORIGIN);return {feedback:await service.saveFeedback((await context.params).id,input)};});
}
