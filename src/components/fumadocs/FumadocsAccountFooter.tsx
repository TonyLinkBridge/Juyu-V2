import {AccountMenu} from '../shell/AdminFrame';

/** Account controls rendered through Fumadocs' official sidebar footer slot. */
export function FumadocsAccountFooter({locale='zh-CN'}:{locale?:'zh-CN'|'en'}){
 return <div className="fumadocs-account fumadocs-sidebar-account"><AccountMenu enabled locale={locale} accountOnly/></div>;
}
