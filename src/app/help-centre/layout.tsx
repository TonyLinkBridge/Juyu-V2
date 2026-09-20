import type {ReactNode} from 'react';
import {ReaderFrame} from '../../components/shell/ReaderFrame';
import {readReaderPresentation} from '../../server/reader-presentation';
import {employeeCompanyAccess} from '../../server/authentication/company-clerk';
// Only the frame persists. Every page still checks enrollment, identity and permissions.
export default async function ReaderLayout({children}:{children:ReactNode}){
 const access=await employeeCompanyAccess();
 if(access.status!=='verified')return children;
 let frame;
 try{
  frame=await readReaderPresentation();
 }catch{return children;}
 const {items,features}=frame;
 return <ReaderFrame items={items} searchEnabled={features.search}>{children}</ReaderFrame>;
}
