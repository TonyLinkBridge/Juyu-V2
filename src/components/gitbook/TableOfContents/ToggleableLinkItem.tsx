// Adapted from GitBook ToggleableLinkItem.tsx (GPL-3.0).
// Retains the leaf LinkItem and exact active-path comparison. Descendants are T018.
// Vendor Link is replaced with a same-origin anchor: every click rechecks the server.
import type {ReactNode} from 'react';
import {ToCLinkItemStyles,ToCLinkItemActiveStyles} from './styles';

export function ToggleableLinkItem(props:{href:string;pathnames:string[];currentPagePath:string;children:ReactNode}) {
 const {href,children,pathnames,currentPagePath}=props;
 const isActive=pathnames.some(pathname=>pathname===currentPagePath);
 return <LinkItem href={href} isActive={isActive}>{children}</LinkItem>;
}
function LinkItem(props:{href:string;isActive:boolean;children:ReactNode}) {
 const {isActive,href,children}=props;
 return <a data-active={isActive} href={href} aria-current={isActive?'page':undefined}
   className={['ToCLinkItemStyles',...ToCLinkItemStyles.flat(),...(isActive?['ToCLinkItemActiveStyles',...ToCLinkItemActiveStyles]:[])].join(' ')}>
   {children}
 </a>;
}
