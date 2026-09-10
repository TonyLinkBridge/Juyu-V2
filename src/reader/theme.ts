export type ThemeMode = 'light' | 'system' | 'dark';
export const THEME_STORAGE_KEY = 'juyu.theme.v1';
export function themeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}
// Constant first-paint script; no user content or private data is interpolated.
export const THEME_BOOTSTRAP = `(function(){var m='system';try{var v=localStorage.getItem('juyu.theme.v1');if(v==='light'||v==='dark')m=v;}catch{}var r=document.documentElement;r.dataset.themeMode=m;r.dataset.theme=m==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;})();`;
