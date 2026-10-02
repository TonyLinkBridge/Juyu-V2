import {developerRoute,developerInput} from '../../../../../server/developers/http';
import {checkDeveloperIntegration} from '../../../../../server/developers/application';
export const dynamic='force-dynamic';
export function GET(request:Request){return developerRoute(service=>{if(new URL(request.url).search)throw Error('INVALID_INPUT');return service.integrations();});}
export function POST(request:Request){return developerRoute(async()=>{const input=await developerInput(request);if(Object.keys(input).length!==1||!('id' in input))throw Error('INVALID_INPUT');return checkDeveloperIntegration(input.id);});}
