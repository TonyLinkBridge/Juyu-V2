import 'server-only';
import {cache} from 'react';
import type {Viewer} from '../../domain/model.ts';
import {employeeSession} from './clerk.ts';
import {resolveAccountAccess} from './account.ts';

export const currentAccountAccess=cache(async()=>{
 const session=await employeeSession();
 if(session.status!=='signed_in')return session;
 const {applicationDatabase}=await import('../database/application.ts');
 return resolveAccountAccess(session,id=>applicationDatabase().members.account(id));
});

export const currentAccountViewer=cache(async():Promise<Viewer|null>=>{
 const access=await currentAccountAccess();
 if(access.status==='ready')return access.viewer;
 if(access.status==='unconfigured')throw new Error('AUTH_NOT_CONFIGURED');
 if(access.status==='unavailable')throw new Error('SERVICE_UNAVAILABLE');
 if(access.status==='pending')throw new Error('MEMBER_PENDING');
 return null;
});
