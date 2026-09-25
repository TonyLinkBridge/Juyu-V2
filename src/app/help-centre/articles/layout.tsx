import type {ReactNode} from 'react';
import {RootProvider} from 'fumadocs-ui/provider/next';
import '../../fumadocs-reader.css';

export default function FormalArticleLayout({children}:{children:ReactNode}){
 return <RootProvider theme={{enabled:false}} search={{options:{api:'/api/fumadocs-search'}}}>{children}</RootProvider>;
}
