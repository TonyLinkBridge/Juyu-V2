import type {ReactNode} from 'react';
import {FumadocsSearchProvider} from '../../../components/fumadocs/FumadocsSearchProvider';
import '../../fumadocs-reader.css';

export default function FumadocsReaderPreviewLayout({children}:{children:ReactNode}){
 return <FumadocsSearchProvider locale="zh-CN">{children}</FumadocsSearchProvider>;
}
