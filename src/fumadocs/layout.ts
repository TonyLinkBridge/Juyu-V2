import type {MenuItem} from '../navigation-settings/model';

const englishNames:Record<string,string>={
 '/help-centre':'Help Centre',
 '/help-centre/ops':'OPS Internal',
 '/help-centre/reference':'Reference',
 '/help-centre/qa':'Q&A',
 '/help-centre/favorites':'Saved articles',
 '/help-centre/recent':'Recently viewed',
 '/help-centre/forms':'Internal forms · Chinese only',
 '/help-centre/changelog':"What's new",
};

/** Convert the authorized JUYU menu into Fumadocs' official layout links. */
export function fumadocsMenuLinks(items:MenuItem[],locale:'zh-CN'|'en'){
 const english=locale==='en';
 return items.map(item=>({
  type:'main' as const,
  text:english?(englishNames[item.href]??item.label):item.label,
  url:english&&['/help-centre','/help-centre/ops','/help-centre/reference','/help-centre/qa','/help-centre/favorites','/help-centre/recent','/help-centre/changelog'].includes(item.href)?`${item.href}?lang=en`:item.href,
  on:'menu' as const,
 }));
}
