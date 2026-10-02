import {developerRoute} from '../../../../../server/developers/http';
export const dynamic='force-dynamic';
export function GET(request:Request){return developerRoute(service=>{if(new URL(request.url).search)throw Error('INVALID_INPUT');return service.access();});}
