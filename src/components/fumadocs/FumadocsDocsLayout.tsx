import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import type {ComponentProps} from 'react';

type Props=ComponentProps<typeof DocsLayout>;

/** Keep the official Fumadocs layout while giving its real root container a stable scope. */
export function FumadocsDocsLayout({containerProps,...props}:Props){
 const className=[containerProps?.className,'juyu-fumadocs'].filter(Boolean).join(' ');
 return <DocsLayout {...props} containerProps={{...containerProps,className}}/>;
}
