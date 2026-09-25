'use client';
import {HeaderSearch} from './HeaderSearch';
import {useEffect,type ReactNode} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {InReaderFrame,Brand,AccountMenu} from './AdminFrame';
import {ReaderChrome} from '../reader-chrome';
import {ReaderQuickLinks} from '../navigation-settings/ReaderQuickLinks';
import {SearchInput} from '../gitbook/Search/SearchInput';
import type {MenuItem} from '../../navigation-settings/model';
/** Persistent presentation only. Destination pages and all APIs keep their server checks. */
export function ReaderFrame({children,items,searchEnabled,accountEnabled=true}:{children:ReactNode;items:MenuItem[];searchEnabled:boolean;accountEnabled?:boolean}){
 const path=usePathname(),params=useSearchParams();
 const locale=params.get('lang')==='en'?'en':'zh-CN';
 useEffect(()=>{document.documentElement.lang=locale;return()=>{document.documentElement.lang='zh-CN';};},[locale]);
 if(path==='/help-centre')return <InReaderFrame.Provider value={true}>{children}</InReaderFrame.Provider>;
 const fumadocsDirectory=path==='/help-centre/library'||path.startsWith('/help-centre/categories/');
 if(path.startsWith('/help-centre/articles/')||path==='/help-centre/ops'||path==='/help-centre/reference'||path==='/help-centre/qa'||path==='/help-centre/favorites'||path==='/help-centre/recent'||path==='/help-centre/forms'||path.startsWith('/help-centre/forms/')||path==='/help-centre/changelog'||path==='/help-centre/pdf'||fumadocsDirectory)return <InReaderFrame.Provider value={true}>{children}</InReaderFrame.Provider>;
 return <InReaderFrame.Provider value={true}><div className="entry-frame knowledge-shell"><a className="skip-link" href="#main-content">{locale==='en'?'Skip to main content':'跳到主要内容'}</a><ReaderChrome><header className="site-header has-search"><Brand locale={locale}/><HeaderSearch locale={locale}>{searchEnabled?<SearchInput locale={locale}/>:<span className="internal-label">{locale==='en'?'Team knowledge':'内部资料库'}</span>}</HeaderSearch><AccountMenu enabled={accountEnabled} locale={locale}/></header></ReaderChrome><div className="knowledge-body"><aside className="knowledge-sidebar"><ReaderQuickLinks items={items} locale={locale}/></aside><div className="knowledge-content">{children}</div></div></div></InReaderFrame.Provider>;
}
