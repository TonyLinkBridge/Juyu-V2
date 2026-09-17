'use client';

import NextLink,{useLinkStatus} from 'next/link';
import {useRouter} from 'next/navigation';
import type {ComponentProps} from 'react';

type NavigationLinkProps=ComponentProps<typeof NextLink>&{
  prefetchOnIntent?:boolean;
};

function Pending(){
  const {pending}=useLinkStatus();
  return pending?<span className="juyu-nav-pending" role="status" aria-label="正在打开页面"/>:null;
}

export function NavigationLink({
  children,
  prefetchOnIntent=false,
  onMouseEnter,
  onFocus,
  href,
  ...props
}:NavigationLinkProps){
  const router=useRouter();

  const prepare=()=>{
    if(prefetchOnIntent){
      router.prefetch(typeof href==='string'?href:href.toString());
    }
  };

  return (
    <NextLink
      {...props}
      href={href}
      onMouseEnter={event=>{
        prepare();
        onMouseEnter?.(event);
      }}
      onFocus={event=>{
        prepare();
        onFocus?.(event);
      }}
    >
      {children}
      <Pending/>
    </NextLink>
  );
}