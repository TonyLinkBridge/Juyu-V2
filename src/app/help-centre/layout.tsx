import type {ReactNode} from 'react';
import {ReaderFrame} from '../../components/shell/ReaderFrame';
import {readReaderPresentation} from '../../server/reader-presentation';
import {currentAccountAccess} from '../../server/authentication/account-clerk';
export default async function ReaderLayout({children}:{children:ReactNode}){
 const access=await currentAccountAccess();
 if(access.status!=='ready')return children;
 let frame;
 try{
  frame=await readReaderPresentation();
 }catch{return children;}
 const {items,features}=frame;
 return <ReaderFrame items={items} searchEnabled={features.search}>{children}</ReaderFrame>;
}
