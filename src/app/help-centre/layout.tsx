import type {ReactNode} from 'react';
import {ReaderFrame} from '../../components/shell/ReaderFrame';
import {ReaderQuickLinks} from '../../components/navigation-settings/ReaderQuickLinks';
import {SearchInput} from '../../components/gitbook/Search/SearchInput';
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
 return <ReaderFrame navigation={<ReaderQuickLinks items={items}/>} search={features.search?<SearchInput/>:<span className="internal-label">内部资料库</span>}>{children}</ReaderFrame>;
}
