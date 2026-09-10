import {clerkConfiguration} from '../../config/clerk';
import type {ReactNode} from 'react';
import {AdminFrame} from '../../components/shell/AdminFrame';
// This persistent frame contains no private data. Every destination retains its server gate.
export default function AdminLayout({children}:{children:ReactNode}){return <AdminFrame accountEnabled={clerkConfiguration(process.env)==='configured'}>{children}</AdminFrame>;}
