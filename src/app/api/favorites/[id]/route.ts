import {applicationAuthorization} from '../../../../server/authorization/application';
import {favoriteRevision,favoritesResponse} from '../../../../server/favorites/http';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){return favoritesResponse(async()=>{const {id}=await params,revision=favoriteRevision(new URL(request.url)),service=await applicationAuthorization();return service.favorite(id,revision);});}
export async function PUT(request:Request,{params}:Context){return favoritesResponse(async()=>{if(new URL(request.url).search)throw new Error('INVALID_INPUT');const {id}=await params,service=await applicationAuthorization();let input:unknown;try{input=await request.json();}catch{throw new Error('INVALID_INPUT');}return service.saveFavorite(id,input);});}
