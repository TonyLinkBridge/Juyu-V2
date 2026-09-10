'use client';
import {useEffect, useRef, type ReactNode} from 'react';
// Keep the complete desktop directory within the viewport as the banner wraps or closes.
export function ReaderChrome({children}:{children:ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => element.parentElement?.style.setProperty('--reader-chrome-height', `${element.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="reader-chrome">{children}</div>;
}
