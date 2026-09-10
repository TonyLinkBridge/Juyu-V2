import {applicationAuthorization} from '../../../server/authorization/application';
import {favoritesPage,favoritesResponse} from '../../../server/favorites/http';
export const dynamic='force-dynamic';
export async function GET(request:Request){return favoritesResponse(async()=>{const page=favoritesPage(new URL(request.url)),service=await applicationAuthorization();return service.favorites(page);});}
