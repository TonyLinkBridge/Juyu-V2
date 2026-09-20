'use client';
import {useAuth} from '@clerk/nextjs';
import type {ComponentProps} from 'react';
import {QaAnswer} from './QaAnswer';
export function AuthenticatedQaAnswer({viewerId,...props}:ComponentProps<typeof QaAnswer>&{viewerId?:string}){
 const {isLoaded,userId,sessionId}=useAuth();
 if(!isLoaded)return <p role="status">正在确认账号并加载问答…</p>;
 if(!sessionId||!viewerId||userId!==viewerId)return <p role="alert">登录状态已变化，请刷新页面重新确认权限。</p>;
 const scope=JSON.stringify([userId,sessionId]);
 return <QaAnswer key={`${scope}:${props.id}:${props.revision}`} {...props} cacheScope={scope}/>;
}
