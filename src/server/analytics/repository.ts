import {requireFeature} from '../features/repository.ts';
import type {PoolClient} from 'pg';
import {analyticsInput,type AnalyticsReceipt} from '../../analytics/model.ts';
/** All actor, permission, snapshot, deduplication and timestamp decisions stay in the database. */
export async function captureAnalytics(c:PoolClient,input:unknown):Promise<AnalyticsReceipt> {await requireFeature(c,'analytics');
 const parsed=analyticsInput(input);
 return (await c.query<{receipt:AnalyticsReceipt}>('SELECT juyu.capture_analytics($1::jsonb) AS receipt',[JSON.stringify(parsed)])).rows[0].receipt;
}
