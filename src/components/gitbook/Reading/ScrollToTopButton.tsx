'use client';
// Adapted from GitBook ScrollToTopButton; respect reduced motion and restore
// keyboard focus to the article heading without changing its URL/deep link.
import type {ComponentPropsWithRef} from 'react';
export function ScrollToTopButton(props:Omit<ComponentPropsWithRef<'button'>,'type'>) {
 return <button {...props} type="button" onClick={event=>{
   props.onClick?.(event);
   if(!event.isDefaultPrevented()){
     document.getElementById('reader-page-title')?.focus({preventScroll:true});
     window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   }
 }}/>;
}
