import {BookOpen,Users,ShieldCheck,Plant,CurrencyDollar,Plugs,ChatCircle,FileText,Globe,ListChecks,Lightbulb} from '@phosphor-icons/react/dist/ssr';
import type {ReaderIconKey} from './icon-keys';
const icons={book:BookOpen,users:Users,shield:ShieldCheck,leaf:Plant,currency:CurrencyDollar,plug:Plugs,chat:ChatCircle,file:FileText,globe:Globe,list:ListChecks,lightbulb:Lightbulb};
export function ReaderIcon({icon,size=16,className='toc-icon'}:{icon:ReaderIconKey;size?:number;className?:string}){
 const Glyph=icons[icon];return <Glyph size={size} className={className} aria-hidden="true"/>;
}
