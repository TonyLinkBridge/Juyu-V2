import {requireFeature} from '../features/repository.ts';
import type {PoolClient} from 'pg';
import {analyticsInput,type AnalyticsReceipt} from '../../analytics/model.ts';
/** All actor, permission, snapshot, deduplication and timestamp decisions stay in the database. */
export async function captureAnalytics(c:PoolClient,input:unknown):Promise<AnalyticsReceipt> {await requireFeature(c,'analytics');
 const parsed=analyticsInput(input);
 const capture=parsed.kind==='view_time'?'juyu.capture_view_time':'juyu.capture_analytics';
 return (await c.query<{receipt:AnalyticsReceipt}>(`SELECT ${capture}($1::jsonb) AS receipt`,[JSON.stringify(parsed)])).rows[0].receipt;
}
