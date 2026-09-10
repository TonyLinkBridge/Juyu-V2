import {Footer} from './gitbook/Footer/Footer';
import {ReaderChrome} from './reader-chrome';
import {AnnouncementBanner} from './gitbook/Announcement/AnnouncementBanner';
import type {ReaderAnnouncement} from '../config/reader-presentation';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function EntryShell({ children, search, announcement, navigation }: { children: ReactNode; search?:ReactNode; announcement?:ReaderAnnouncement; navigation?:ReactNode }) {
  return <div className="flex min-h-dvh flex-col">
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <ReaderChrome><header className={search?"site-header has-search":"site-header"}>
      <Link href="/" className="brand" aria-label="JUYU Help Centre 首页">
        <span className="brand-name">JUYU<span className="brand-dot" /></span>
        <span className="brand-divider" />
        <span className="brand-product">Help Centre</span>
      </Link>
      {search??<span className="internal-label">内部资料库</span>}
    </header>{navigation}{announcement && <AnnouncementBanner announcement={announcement}/>}</ReaderChrome>
    {children}
    <Footer/>
  </div>;
}

export function BookIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 5.5C9 3.5 5.5 3.5 3 4.5v15c2.5-1 6-1 9 1 3-2 6.5-2 9-1v-15c-2.5-1-6-1-9 1Z" /><path d="M12 5.5v15" /></svg>;
}

export function ShieldIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>;
}
