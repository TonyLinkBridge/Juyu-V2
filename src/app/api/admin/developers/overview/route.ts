import {developerRoute} from '../../../../../server/developers/http';
export const dynamic='force-dynamic';
export function GET(request:Request){return developerRoute(service=>{const params=new URL(request.url).searchParams;for(const k of params.keys())if(k!=='days'||params.getAll(k).length!==1)throw Error('INVALID_INPUT');return service.overview(Number(params.get('days')??30));});}
