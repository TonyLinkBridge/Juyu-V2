import type {ReactNode} from 'react';
import foundation from '../user-menu/foundation.module.css';
import styles from './scope.module.css';
export function ArcScope({children,className=''}:{children:ReactNode;className?:string}){
 return <div className={`juyu-arc ${foundation.foundation} ${styles.scope} ${className}`}>{children}</div>;
}
