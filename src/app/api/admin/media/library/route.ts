import {applicationAuthorization} from '../../../../../server/authorization/application';
import {mediaResponse} from '../../../../../server/media/upload';
export const dynamic='force-dynamic';
export async function GET(request:Request){return mediaResponse(async()=>{
 const input:Record<string,string>={};for(const [key,value] of new URL(request.url).searchParams){if(Object.hasOwn(input,key))throw new Error('INVALID_INPUT');input[key]=value;}
 return (await applicationAuthorization()).mediaLibrary(input);
});}
