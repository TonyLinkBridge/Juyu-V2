import {BookOpen,Users,ShieldCheck,Plant,CurrencyDollar,Plugs,ChatCircle,FileText,Globe,ListChecks,Lightbulb} from '@phosphor-icons/react/dist/ssr';
import type {ReaderIconKey} from './icon-keys';

export const readerIconComponents:Record<ReaderIconKey,typeof BookOpen>={
 book:BookOpen,
 users:Users,
 shield:ShieldCheck,
 leaf:Plant,
 currency:CurrencyDollar,
 plug:Plugs,
 chat:ChatCircle,
 file:FileText,
 globe:Globe,
 list:ListChecks,
 lightbulb:Lightbulb,
};
