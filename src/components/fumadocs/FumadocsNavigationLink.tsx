"use client";
import type {ComponentProps} from 'react';
import {NavigationLink} from '../shell/NavigationLink';

/** Official Fumadocs framework slot, with Next.js pending feedback on its real links. */
export function FumadocsNavigationLink({href,className,...props}:ComponentProps<'a'>&{prefetch?:boolean}){
 if(!href)return <a {...props} className={className}/>;
 return <NavigationLink {...props} href={href} className={[className,'juyu-fumadocs-navigation-link'].filter(Boolean).join(' ')}/>;
}
