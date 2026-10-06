"use client";
import {motion} from 'motion/react';
import {useSyncExternalStore} from 'react';
import type {CSSProperties,HTMLAttributes} from 'react';

export interface LoaderSkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>,'children'> {
 width?:CSSProperties['width'];
 height?:CSSProperties['height'];
 borderRadius?:CSSProperties['borderRadius'];
 baseColor?:string;
 highlightColor?:string;
 duration?:number;
 animated?:boolean;
}

// Subscribe to preference changes as well as the initial value. CSS also covers SSR.
let reducedMotionQuery:MediaQueryList|undefined;
function motionPreference(){return reducedMotionQuery??=window.matchMedia('(prefers-reduced-motion: reduce)');}
function subscribeMotionPreference(notify:()=>void){const query=motionPreference();query.addEventListener('change',notify);return()=>query.removeEventListener('change',notify);}
function prefersReducedMotion(){return motionPreference().matches;}
function serverMotionPreference(){return false;}

/** Decorative placeholder; the containing loading region announces its status once. */
export function LoaderSkeleton({className,width='100%',height=20,borderRadius=7,baseColor,highlightColor,duration=1.8,animated=true,style,'aria-hidden':ariaHidden=true,...props}:LoaderSkeletonProps){
 const reduceMotion=useSyncExternalStore(subscribeMotionPreference,prefersReducedMotion,serverMotionPreference);
 return <div {...props} aria-hidden={ariaHidden} className={['juyu-skeleton',className].filter(Boolean).join(' ')} style={{width,height,borderRadius,...(baseColor?{backgroundColor:baseColor}:{}),...style}}>
  {animated&&!reduceMotion&&<motion.div className="juyu-skeleton-shimmer" aria-hidden="true" style={{background:`linear-gradient(90deg, transparent, ${highlightColor??'var(--skeleton-highlight)'}, transparent)`}} initial={{x:'-100%'}} animate={{x:['-100%','100%']}} transition={{duration,ease:'easeInOut',repeat:Infinity}}/>}
 </div>;
}
export default LoaderSkeleton;
