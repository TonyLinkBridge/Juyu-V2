'use client';
// Adapted from GitBook ThemeToggler; see docs/sources/T023-presentation.json.
import {useId, useSyncExternalStore} from 'react';
import {THEME_STORAGE_KEY, themeMode, type ThemeMode} from '../../../reader/theme';
const eventName = 'juyu-theme-change';
function apply(mode: ThemeMode) {
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
}
function snapshot() { return themeMode(document.documentElement.dataset.themeMode); }
function serverSnapshot(): ThemeMode { return 'system'; }
function subscribe(notify: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const sync = () => { apply(snapshot()); notify(); };
  const storage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      apply(themeMode(event.newValue)); notify();
    }
  };
  if (!document.documentElement.dataset.themeMode) {
    let mode: ThemeMode = 'system';
    try { mode = themeMode(localStorage.getItem(THEME_STORAGE_KEY)); } catch { /* Private browsing fallback. */ }
    apply(mode);
  }
  media.addEventListener('change', sync);
  window.addEventListener('storage', storage);
  window.addEventListener(eventName, sync);
  sync();
  return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', storage); window.removeEventListener(eventName, sync); };
}
function setMode(mode: ThemeMode) {
  apply(mode);
  try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* Still usable for this page. */ }
  window.dispatchEvent(new Event(eventName));
}
export function ThemeToggler({compact=false,locale='zh-CN'}:{compact?:boolean;locale?:'zh-CN'|'en'}={}) {
  const selected = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const name = useId();
  const choices=locale==='en'?([['light','Light'],['system','System'],['dark','Dark']] as const):([['light','浅色'],['system','跟随系统'],['dark','深色']] as const);
  return <fieldset className={`theme-toggler ${compact?'theme-toggler-compact':''}`}><legend>{locale==='en'?'Appearance':'外观主题'}</legend>
    {choices.map(([mode,label]) =>
      <label key={mode} title={label}>
        <input aria-label={label} type="radio" name={name} value={mode} checked={selected === mode} onChange={() => setMode(mode)}/>
        <span><ThemeIcon mode={mode}/>{compact?<span className="theme-choice-label">{label}</span>:label}</span>
      </label>)}
  </fieldset>;
}
function ThemeIcon({mode}:{mode:ThemeMode}) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    {mode === 'light' ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></> : mode === 'system' ? <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8"/></> : <path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>}
  </svg>;
}
