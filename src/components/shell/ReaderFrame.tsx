'use client';
import {HeaderSearch} from './HeaderSearch';
import type {ReactNode} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {InReaderFrame,Brand,AccountMenu} from './AdminFrame';
import {ReaderChrome} from '../reader-chrome';
/** Persistent presentation only. Destination pages and all APIs keep their server checks. */
export function ReaderFrame({children,navigation,search,accountEnabled=true}:{children:ReactNode;navigation:ReactNode;search:ReactNode;accountEnabled?:boolean}){
 const path=usePathname(),params=useSearchParams();
 const home=path==='/help-centre'&&!params.has('article')&&!params.has('q');
 const article=path==='/help-centre'&&params.has('article')&&!params.has('q');
 return <InReaderFrame.Provider value={true}><div className="entry-frame knowledge-shell"><a className="skip-link" href="#main-content">跳到主要内容</a><ReaderChrome><header className={`site-header ${home?'home-header':'has-search'}`}><Brand/>{!home&&<HeaderSearch>{search}</HeaderSearch>}<AccountMenu enabled={accountEnabled}/></header></ReaderChrome><div className="knowledge-body">{!article&&<aside className="knowledge-sidebar">{navigation}</aside>}<div className="knowledge-content">{children}</div></div></div></InReaderFrame.Provider>;
}
