import {HomeLayout} from 'fumadocs-ui/layouts/home';
import {Suspense,type ComponentProps,type ReactNode} from 'react';
import type {ReaderAnnouncement} from '../../config/reader-presentation';
import type {MenuItem} from '../../navigation-settings/model';
import {fumadocsMenuLinks} from '../../fumadocs/layout';
import {AnnouncementBanner} from '../gitbook/Announcement/AnnouncementBanner';
import {NewAnnouncements} from '../announcements/NewAnnouncements';
import {KnowledgeHome} from '../home/KnowledgeHome';
import {AccountMenu} from '../shell/AdminFrame';
import {FumadocsPublicationI18n} from './FumadocsPublicationI18n';
import type {FumadocsPublicationLocale} from '../../fumadocs/publication';
import {FumadocsSearchProvider} from './FumadocsSearchProvider';
import '../../app/fumadocs-reader.css';

interface FumadocsHomeShellProps {
 children:ReactNode;
 menu?:MenuItem[];
 search?:boolean;
 account?:boolean;
 locale?:FumadocsPublicationLocale;
}

export function FumadocsHomeContent({children,menu=[],account=false,locale='zh-CN'}:FumadocsHomeShellProps){
 const links=[...fumadocsMenuLinks(menu,locale),...(account?[{type:'custom' as const,secondary:true,children:<div className="fumadocs-account"><AccountMenu enabled locale={locale} accountOnly/></div>}]:[])];
 return <FumadocsPublicationI18n locale={locale}><HomeLayout
  id="main-content"
  data-fumadocs-home-page=""
  links={links}
  nav={{title:<span className="juyu-home-brand"><strong>JUYU</strong><span>Help Centre</span></span>,url:locale==='en'?'/help-centre?lang=en':'/help-centre'}}
  searchToggle={{enabled:false}}
 >{children}</HomeLayout></FumadocsPublicationI18n>;
}

export function FumadocsHomeShell(props:FumadocsHomeShellProps){
 const locale=props.locale??'zh-CN';
 return <FumadocsSearchProvider locale={locale}><FumadocsHomeContent {...props}/></FumadocsSearchProvider>;
}

type KnowledgeHomeProps=ComponentProps<typeof KnowledgeHome>;
interface FumadocsKnowledgeHomeProps extends KnowledgeHomeProps {
 announcement?:ReaderAnnouncement;
}

export function FumadocsKnowledgeHomeContent({announcement,...props}:FumadocsKnowledgeHomeProps){
 return <FumadocsHomeContent menu={props.menu} search={props.search} account locale={props.locale}>
  {announcement&&announcement.id!=='internal-materials'&&<AnnouncementBanner announcement={announcement}/>}
  <Suspense fallback={null}><NewAnnouncements silentFailure/></Suspense>
  <KnowledgeHome {...props}/>
 </FumadocsHomeContent>;
}

export function FumadocsKnowledgeHome(props:FumadocsKnowledgeHomeProps){
 const locale=props.locale??'zh-CN';
 return <FumadocsSearchProvider locale={locale}><FumadocsKnowledgeHomeContent {...props}/></FumadocsSearchProvider>;
}
