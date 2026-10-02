import {clerkConfiguration} from '../../config/clerk';
import {currentAccountAccess} from '../../server/authentication/account-clerk';
import {developerAccess} from '../../server/developers/guard';
import type {ReactNode} from 'react';
import {AdminFrame} from '../../components/shell/AdminFrame';
import './fumadocs-theme.css';
import './admin-data.css';
// This persistent frame contains no private data. Every destination retains its server gate.
export default async function AdminLayout({children}:{children:ReactNode}){const enabled=clerkConfiguration(process.env)==='configured';let developer=false;try{if(enabled)developer=developerAccess(await currentAccountAccess());}catch{}return <AdminFrame accountEnabled={enabled} developerEnabled={developer}>{children}</AdminFrame>;}
