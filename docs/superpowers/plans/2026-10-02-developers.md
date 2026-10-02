# JUYU Developers implementation

Approved scope: integrate existing services and operational records into four Super Admin pages. Preserve JUYU branding. No external JUYU API credentials, arbitrary webhook destinations, credential reveal/rotation, or production changes in this implementation turn.

1. Add safe integration metadata and exact Super Admin guards. Configuration presence must never be represented as successful connectivity. Read-only probes: public Clerk signing keys, restricted database roles, private storage bucket, Slack bot identity. Cron configuration is not proof the scheduler ran.
2. Add migration 0056 for sanitized request/connection/client diagnostics (30-day retention), Super Admin-only outbox reads, and guarded retry scheduling with an immutable operator record. Audit history stays intact. Request telemetry is bounded, asynchronous and failure isolated; capture assets, PDF and publication, with the scope visible in UI.
3. Implement authorized data APIs for overview, integrations, notification history/retry and searchable events. Enforce fresh server identity and database role; reject cross-origin mutations. No raw secret, request body, token, URL query or vendor error in browser DTOs/log records.
4. Implement Overview, API Keys (existing integration credentials), Webhooks (Slack notification delivery), Events/Logs, and role-gated navigation. Use JUYU tokens, compact responsive tables, useful empty/error states, real filtering, connection checks, safe retry confirmation and pagination.
5. Verify unit suite, real PostgreSQL roles/RLS/retry tests, typecheck, lint, production build, desktop/mobile browser interaction and keyboard accessibility. Browser fixtures are clearly marked and never shipped as product data. Leave production database/deployment status explicit.

Review focus: ordinary Admin and stale/disabled Super Admin; secret redaction; sent/leased retry races; telemetry failure cannot affect original requests; missing migration versus genuine empty data; check results after network failure; pagination/filter races.

Execution: inline. User authorized the researched design and explicitly requested implementation. Retain current checkout and do not introduce a second project. The written plan records the agreed scope, not another approval request.

Release authorization (2026-10-03): user approved the follow-up production migration, main push/deployment and live acceptance. The original no-production constraint applies to the 2026-10-02 implementation turn only.
