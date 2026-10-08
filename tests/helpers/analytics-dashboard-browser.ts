import {resolve} from 'node:path';
import {arcBrowserBundle} from './arc-browser';
export async function dashboardBrowserBundle(){return arcBrowserBundle('analytics-dashboard',`import React from 'react';import {createRoot} from 'react-dom/client';import {AnalyticsDashboard} from '${resolve('src/components/analytics/AnalyticsDashboard.tsx')}';const props=JSON.parse(document.getElementById('data').textContent);createRoot(document.getElementById('dashboard')).render(React.createElement(AnalyticsDashboard,props));`);}
