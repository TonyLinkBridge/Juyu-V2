import {clerkConfiguration} from '../../config/clerk';
import {currentAccountAccess} from '../../server/authentication/account-clerk';
import {developerAccess} from '../../server/developers/guard';
import type {AdminGuideRole} from '../../components/onboarding/UsageGuide';
import type {ReactNode} from 'react';
import {AdminFrame} from '../../components/shell/AdminFrame';
import './fumadocs-theme.css';
import './admin-data.css';
// This persistent frame contains no private data. Every destination retains its server gate.
export default async function AdminLayout({children}:{children:ReactNode}){const enabled=clerkConfiguration(process.env)==='configured';let developer=false;let guideRole:AdminGuideRole|null=null;try{if(enabled){const access=await currentAccountAccess();developer=developerAccess(access);if(access.status==='ready'&&(access.viewer.role==='admin'||access.viewer.role==='super_admin'))guideRole=access.viewer.role;}}catch{}return <AdminFrame accountEnabled={enabled} developerEnabled={developer} guideRole={guideRole}>{children}</AdminFrame>;}
