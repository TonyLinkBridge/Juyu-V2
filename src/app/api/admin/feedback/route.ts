import {applicationAuthorization} from '../../../../server/authorization/application.ts';
import {feedbackResponse} from '../../../../server/feedback/http.ts';
import {positiveInteger} from '../../../../feedback/model.ts';
export const dynamic='force-dynamic';
export async function GET(request:Request){return feedbackResponse(async()=>{const service=await applicationAuthorization();const p=new URL(request.url).searchParams;return p.has('document')?service.feedbackDetails(p.get('document')!,positiveInteger(Number(p.get('revision'))),p.get('page')):service.feedbackOverview(p.get('page'));});}
