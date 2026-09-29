'use client';
import {Banner} from 'fumadocs-ui/components/banner';
import type {ReaderAnnouncement} from '../../../config/reader-presentation';
export function AnnouncementBanner({announcement}:{announcement:ReaderAnnouncement}) {
 return <Banner
  id={`juyu-announcement-${announcement.id}-${announcement.revision}`}
  data-nosnippet=""
  role="region"
  aria-label="资料库公告"
  className="reader-announcement"
  changeLayout={false}
 >{announcement.message}</Banner>;
}
