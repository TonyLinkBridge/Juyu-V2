'use client';
import {useAuth} from '@clerk/nextjs';
import type {ComponentProps} from 'react';
import {QaAnswer} from './QaAnswer';
export function AuthenticatedQaAnswer({viewerId,...props}:ComponentProps<typeof QaAnswer>&{viewerId?:string}){
 const {isLoaded,userId,sessionId}=useAuth();
 if(!isLoaded||!sessionId||!viewerId||userId!==viewerId)return null;
 const scope=JSON.stringify([userId,sessionId]);
 return <QaAnswer key={`${scope}:${props.id}:${props.revision}`} {...props} cacheScope={scope}/>;
}
