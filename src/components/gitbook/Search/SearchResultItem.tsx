// Adapted from GitBook SearchResultItem: icon / content / trailing action.
import type {ReactNode} from 'react';
export function SearchResultItem({children,href,leadingIcon,label}:{children:ReactNode;href:string;leadingIcon:ReactNode;label:string}) {
 return <a href={href} className="gitbook-search-result" aria-label={label}>
   <span className="search-result-icon">{leadingIcon}</span>
   <div className="search-result-content">{children}</div>
   <span className="search-result-arrow" aria-hidden="true">→</span>
 </a>;
}
