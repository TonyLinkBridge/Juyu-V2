import type {ReactNode} from 'react';
import {type FeatureKey} from '../../features/model';
import {applicationAuthorization} from '../../server/authorization/application';
import {EntryShell} from '../entry-shell';
import {FeatureNotice} from './FeatureNotice';
export async function FeaturePage({feature,admin=false,children}:{feature:FeatureKey;admin?:boolean;children:ReactNode}){let enabled=false,unavailable=false;try{enabled=(await(await applicationAuthorization()).features())[feature];}catch{unavailable=true;}return enabled?children:<EntryShell><FeatureNotice feature={feature} unavailable={unavailable} admin={admin}/></EntryShell>;}
