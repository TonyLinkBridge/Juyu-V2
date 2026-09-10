'use client';
// Adapted from GitBook's message/icon/close banner; dismissal is version-specific.
import {useSyncExternalStore} from 'react';
import type {ReaderAnnouncement} from '../../../config/reader-presentation';
const dismissed = new Set<string>();
const changeEvent = 'juyu-announcement-change';
function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify); window.addEventListener('storage', notify);
  return () => { window.removeEventListener(changeEvent, notify); window.removeEventListener('storage', notify); };
}
export function AnnouncementBanner({announcement}:{announcement:ReaderAnnouncement}) {
  const key = `juyu.announcement.${encodeURIComponent(announcement.id)}.${encodeURIComponent(announcement.revision)}`;
  const hidden = useSyncExternalStore(subscribe, () => {
    if (dismissed.has(key)) return true;
    try { return localStorage.getItem(key) === 'dismissed'; } catch { return false; }
  }, () => true);
  if (hidden) return null;
  return <section data-gb-announcement-banner="" data-nosnippet="" aria-label="资料库公告" className="reader-announcement">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/></svg>
    <p>{announcement.message}</p>
    <button type="button" aria-label="关闭公告" onClick={(event) => {
      // Avoid losing keyboard focus when the close control is removed.
      const main = document.getElementById('main-content');
      if (main) { const previous = main.getAttribute('tabindex'); main.setAttribute('tabindex','-1'); main.focus({preventScroll:true}); main.addEventListener('blur', () => { if (previous === null) main.removeAttribute('tabindex'); else main.setAttribute('tabindex',previous); }, {once:true}); }
      event.preventDefault();
      dismissed.add(key);
      try { localStorage.setItem(key, 'dismissed'); } catch { /* Dismiss for this page even without storage. */ }
      window.dispatchEvent(new Event(changeEvent));
    }}>×</button>
  </section>;
}
