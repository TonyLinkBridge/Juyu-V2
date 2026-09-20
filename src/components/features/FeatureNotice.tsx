import {featureLabels,type FeatureKey} from '../../features/model';
import Link from 'next/link';
export function FeatureNotice({feature,unavailable=false,admin=false,locale='zh-CN'}:{feature:FeatureKey;unavailable?:boolean;admin?:boolean;locale?:'zh-CN'|'en'}){
 const english=locale==='en';
 return <main id="main-content" className="access-main"><h1>{english?(unavailable?'This feature is temporarily unavailable':'This feature is turned off'):(unavailable?'功能状态暂时无法读取':featureLabels[feature]+'已暂停')}</h1><p>{english?(unavailable?'Try reloading the page. If the problem continues, contact an admin.':'An admin has turned this feature off. Your existing data is still saved.'):(unavailable?'请重新加载页面，若持续失败请联系管理员。':'管理员已暂停此功能，已有数据保留。')}</p><Link prefetch={false} className="secondary-link" href={admin?'/admin':english?'/help-centre?lang=en':'/help-centre'}>{english?'Back to Help Centre':admin?'返回管理后台':'返回资料库'}</Link>{admin&&<Link prefetch={false} className="secondary-link" href="/admin/settings/features">管理功能开关</Link>}</main>;
}
