import HelpCentre from '../page';
export const dynamic='force-dynamic';
export default function Library({searchParams}:{searchParams:Promise<{lang?:string|string[]}>}){return <HelpCentre library searchParams={searchParams}/>;}
