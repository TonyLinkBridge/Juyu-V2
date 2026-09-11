'use client';
import NextLink,{useLinkStatus} from 'next/link';
import type {ComponentProps} from 'react';
function Pending(){const {pending}=useLinkStatus();return pending?<span className="juyu-nav-pending" role="status" aria-label="正在打开页面"/>:null;}
export function NavigationLink({children,...props}:ComponentProps<typeof NextLink>){return <NextLink {...props}>{children}<Pending/></NextLink>;}
