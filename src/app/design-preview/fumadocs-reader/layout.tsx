import type {ReactNode} from 'react';
import {RootProvider} from 'fumadocs-ui/provider/next';
import '../../fumadocs-reader.css';

export default function FumadocsReaderPreviewLayout({children}:{children:ReactNode}){
 return <RootProvider search={{enabled:false}}>{children}</RootProvider>;
}
