import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';

const migrations = ['0001_core', '0002_supporting_data', '0003_authorization', '0004_members', '0005_enrollment', '0006_article_presentation', '0007_feedback', '0008_media', '0009_document_lifecycle', '0010_review_submission', '0011_document_availability', '0012_version_history', '0013_ops_collection', '0014_publication_search', '0015_reference', '0016_qa', '0017_favorites', '0018_recent_views', '0019_analytics', '0020_custom_fields', '0021_categories', '0022_forms', '0023_navigation_settings', '0024_feature_flags', '0025_setting_history', '0026_announcements', '0027_native_editor', '0028_qa_search', '0029_shared_revision_config_locks', '0030_publication_number', '0031_scoped_search', '0032_category_icons', '0033_publication_icons', '0034_article_description', '0035_publication_timestamp', '0036_reader_changelog', '0037_reusable_fragments', '0038_reusable_fragment_versions', '0039_release_notes', '0040_document_locales', '0041_english_review_confirmation', '0042_draft_actions', '0043_super_admin_role'] as const;

// Explicit operator entry point. Never invoked by page rendering or startup.
export async function migrate(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(84620908)');
    await client.query(`CREATE SCHEMA IF NOT EXISTS juyu;
      REVOKE ALL ON SCHEMA juyu FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS juyu.schema_migrations (
        version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE juyu.schema_migrations ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON juyu.schema_migrations FROM PUBLIC;`);
    const applied: string[] = [];
    for (const version of migrations) {
      const sql = await readFile(new URL(`./migrations/${version}.sql`, import.meta.url), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>('SELECT checksum FROM juyu.schema_migrations WHERE version=$1', [version]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`MIGRATION_CHANGED: ${version}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO juyu.schema_migrations(version,checksum) VALUES ($1,$2)', [version, checksum]);
      applied.push(version);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
