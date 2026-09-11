# Navigation latency: regional alignment and scoped DB round trips

## Baseline: production Vercel logs, 2026-09-11 GMT+8

Deployment: dpl_DyPquRYgKS2eEULaNy6iM7ZCogyu.
- OPS actual navigation, 15:48:46.900: request s9ph7-1789112926900-1e3e50192ad2. Response 13.0s, function 12.73s, middleware 9ms. Received sin1, executed iad1.
- OPS prefetch, 15:48:46.902: response 490ms, function 5ms. This is a shell-prefetch request and must not be reported as full-page speed.
- Admin navigation, 15:46:09.601: request ck6jt-1789112769601-bfbc580884c7. Response 11.4s, function 11.26s. Received sin1, executed iad1. External API list has one session lookup, one user lookup, one OAuth-token lookup, one Slack userInfo call.
- Local configured runtime and issuer pool hosts encode ap-southeast-1. Credentials were not printed.

These are individual samples, not medians or a controlled benchmark. Existing deployment did not emit application timing records; Vercel's detailed external-API timings require an upgrade, which was not purchased.

## Change
- Pin Vercel Node functions to sin1, matching configured database geography. No database migration or data movement.
- Enable fixed-label application timing logs; no user IDs, content, SQL, token values or vendor errors are serialized. Separate session/user/OAuth/Slack, enrollment, connection-pool acquisition, scoped query work, and page-function timings. Page-function timing ends before descendant React server components finish and is not full-browser navigation time. Nested stage durations must not be summed.
- Combine expired-context cleanup and context insert into one statement. Still insert proof before opening the repeatable-read snapshot.
- Combine backend-PID check and transaction-local limits/proof installation into one statement. No business work runs before checking the PID.
- Successful scoped transaction overhead drops from nine SQL round trips to seven, excluding business queries; role checks, read-only isolation, cleanup, and error rollback remain.
- No TTL identity cache or permission relaxation; no UI-only attempt to hide delay.

Official regional configuration reference: https://vercel.com/docs/functions/configuring-functions/region

## Acceptance
352 unit tests and 385 isolated database tests passed. Lint, TypeScript, production build and compiled CSS guard passed. Production post-deploy samples pending.
