'use client';
// Adapted from GitBook primitives/ScrollContainer.tsx (GPL-3.0).
// Keep the active-item effect and its original positioning helper; omit vendor
// overflow buttons/i18n. Only this scroll container needs client JavaScript.
import * as React from 'react';
export function ScrollContainer({children,activePath}:{children:React.ReactNode;activePath:string}) {
 const containerRef=React.useRef<HTMLDivElement>(null);
 React.useEffect(()=>{
   const container=containerRef.current;
   if(!container||!activePath)return;
   const activeItem=container.querySelector('[data-active="true"]');
   if(!activeItem||!container.contains(activeItem))return;
   const position = () => {
     if (container.clientHeight > 0 && activeItem.getClientRects().length) scrollToElementInContainer(activeItem,container);
   };
   position();
   // Hydration may reveal a banner or change the mobile disclosure. Reposition
   // when this viewport changes size, not on ordinary scrolling.
   const observer = new ResizeObserver(position); observer.observe(container);
   return () => observer.disconnect();
 },[activePath]);
 return <div ref={containerRef} data-testid="toc-scroll-container" className="gitbook-toc-scroll">{children}</div>;
}

function scrollToElementInContainer(element: Element, container: HTMLElement) {
    const containerRect = container.getBoundingClientRect();
    const rect = element.getBoundingClientRect();

    return container.scrollTo({
        top:
            container.scrollTop +
            (rect.top - containerRect.top) -
            container.clientHeight / 2 +
            rect.height / 2,
        left:
            container.scrollLeft +
            (rect.left - containerRect.left) -
            container.clientWidth / 2 +
            rect.width / 2,
        // Use 'auto' to avoid additional scroll animations when scrolling to an element
        // as this may be called during layout/initialization when the page is not fully loaded.
        behavior: 'auto',
    });
}
