import {developerRoute} from '../../../../../server/developers/http';
export const dynamic='force-dynamic';
export function GET(request:Request){return developerRoute(service=>service.events(new URL(request.url).searchParams));}
