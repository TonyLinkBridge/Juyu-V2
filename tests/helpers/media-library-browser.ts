import {resolve} from 'node:path';
import {arcBrowserBundle} from './arc-browser';
export async function mediaLibraryBrowserBundle(){return arcBrowserBundle('media-library',`import React from 'react';import {createRoot} from 'react-dom/client';import {MediaLibrary} from '${resolve('src/components/media/MediaLibrary.tsx')}';const props=JSON.parse(document.getElementById('data').textContent);createRoot(document.getElementById('media-library')).render(React.createElement(MediaLibrary,props));`);}
