import type {ReactNode} from 'react';
import {RootProvider} from 'fumadocs-ui/provider/next';
import '../../fumadocs-reader.css';

export default function FormalArticleLayout({children}:{children:ReactNode}){
 return <RootProvider search={{options:{api:'/api/fumadocs-search'}}}>{children}</RootProvider>;
}
