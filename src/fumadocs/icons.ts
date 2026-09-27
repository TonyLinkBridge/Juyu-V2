import {BookOpen,Users,ShieldCheck,Sprout,CircleDollarSign,Plug,MessageCircle,FileText,Globe,ListChecks,Lightbulb} from 'lucide-react';
import type {ReaderIconKey} from '../reader/icon-keys.ts';

/** Fumadocs' own documentation uses Lucide icons in its page-tree metadata. */
export const fumadocsIconComponents:Record<ReaderIconKey,typeof BookOpen>={
 book:BookOpen,
 users:Users,
 shield:ShieldCheck,
 leaf:Sprout,
 currency:CircleDollarSign,
 plug:Plug,
 chat:MessageCircle,
 file:FileText,
 globe:Globe,
 list:ListChecks,
 lightbulb:Lightbulb,
};
