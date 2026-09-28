import type {ReactNode} from 'react';
import {ReaderFrame} from '../../components/shell/ReaderFrame';

/** Destination pages own authorization and their Fumadocs chrome. This shared
 * wrapper only supplies the reader context; reading the database here would
 * race the destination page during every client-side navigation. */
export default function ReaderLayout({children}:{children:ReactNode}){
 return <ReaderFrame items={[]} searchEnabled={false}>{children}</ReaderFrame>;
}
