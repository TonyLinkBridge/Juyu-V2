import {RootProvider} from 'fumadocs-ui/provider/next';
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
import '../../app/fumadocs-reader.css';

interface FumadocsHomeShellProps {
 children:ReactNode;
 menu?:MenuItem[];
 search?:boolean;
 account?:boolean;
 locale?:FumadocsPublicationLocale;
}

export function FumadocsHomeContent({children,menu=[],search=false,account=false,locale='zh-CN'}:FumadocsHomeShellProps){
 return <FumadocsPublicationI18n locale={locale}><HomeLayout
  id="main-content"
  data-fumadocs-home-page=""
  links={fumadocsMenuLinks(menu,locale)}
  nav={{title:'JUYU Help Centre',url:locale==='en'?'/help-centre?lang=en':'/help-centre',...(account?{children:<div className="fumadocs-account"><AccountMenu enabled locale={locale} accountOnly/></div>}:{})}}
  searchToggle={{enabled:search}}
 >{children}</HomeLayout></FumadocsPublicationI18n>;
}

export function FumadocsHomeShell(props:FumadocsHomeShellProps){
 return <RootProvider search={{options:{api:'/api/fumadocs-search'}}}><FumadocsHomeContent {...props}/></RootProvider>;
}

type KnowledgeHomeProps=ComponentProps<typeof KnowledgeHome>;
interface FumadocsKnowledgeHomeProps extends KnowledgeHomeProps {
 announcement?:ReaderAnnouncement;
}

export function FumadocsKnowledgeHomeContent({announcement,...props}:FumadocsKnowledgeHomeProps){
 return <FumadocsHomeContent menu={props.menu} search={props.search} account locale={props.locale}>
  {announcement&&announcement.id!=='internal-materials'&&<AnnouncementBanner announcement={announcement}/>}
  <Suspense fallback={null}><NewAnnouncements/></Suspense>
  <KnowledgeHome {...props}/>
 </FumadocsHomeContent>;
}

export function FumadocsKnowledgeHome(props:FumadocsKnowledgeHomeProps){
 return <RootProvider search={{options:{api:'/api/fumadocs-search'}}}><FumadocsKnowledgeHomeContent {...props}/></RootProvider>;
}
