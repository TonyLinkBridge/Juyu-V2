import { applicationMembers } from '../../../../server/members/application.ts';
import { memberResponse } from '../../../../server/members/http.ts';
export const dynamic='force-dynamic';
export async function GET(request:Request){return memberResponse(async()=> (await applicationMembers()).list(new URL(request.url).searchParams.get('after')??''));}
