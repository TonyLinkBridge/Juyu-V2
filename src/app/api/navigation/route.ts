import {applicationAuthorization} from '../../../server/authorization/application.ts';
import {protectedResponse} from '../../../server/authorization/service.ts';
export const dynamic='force-dynamic';
export async function GET(_request:Request) {
 void _request; // Identity is obtained only from the verified server session.
 return protectedResponse(async()=> (await applicationAuthorization()).navigationTree());
}
