import type {ReactNode} from 'react';
import {RootProvider} from 'fumadocs-ui/provider/next';
import {fumadocsRootI18n} from '../../../fumadocs/i18n';
import {fumadocsSearchOptions} from '../../../fumadocs/search-options';
import {FumadocsScopedSearchDialog} from '../../../components/fumadocs/FumadocsScopedSearchDialog';
import '../../fumadocs-reader.css';

export default function FumadocsReaderPreviewLayout({children}:{children:ReactNode}){
 return <RootProvider theme={{enabled:false}} i18n={fumadocsRootI18n('zh-CN')} search={{SearchDialog:FumadocsScopedSearchDialog,options:fumadocsSearchOptions('zh-CN')}}>{children}</RootProvider>;
}
