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

## Production verification completed

Code commit 9a7fc2bc96e62a94baf242856c9af06dabfcdb0d deployed successfully as dpl_7X7wxc8WWfuxmWKPV9rDDGnKNyiM. Vercel Ready at approximately 15:57 GMT+8. Runtime logs now show Singapore ingress without the prior routing to iad1. Fixed-stage timing logs are present.

| Navigation | Before response / function | After response / function | Request |
| --- | --- | --- | --- |
| OPS | 13.0s / 12.73s | 1.5s / 1.39s | fvhjk-1789113474539-2fe632656d86, 15:57:54.539 |
| Admin | 11.4s / 11.26s | 1.5s / 1.43s | s9ph7-1789113537457-01db639d03dc, 15:58:57.457 |
| OPS repeat | n/a | 1.3s / 1.29s | vn4pg-1789113596798-4737ff268a59, 15:59:56.798 |

Actual non-prefetch navigation requests, status 200. Browser rendered expected OPS read-only empty state and admin content list. No content mutations performed by this verification.

OPS first sample: Clerk session 344ms, Clerk user 289ms, OAuth-token read 295ms, Slack userInfo 269ms; member bind 22ms; OPS business query work 13ms; scoped transaction 56ms. Page-function 1318ms excludes descendant shell queries. OPS repeat: session 309ms, user 289ms, token read 273ms, Slack 248ms; business query work 12ms; scope 48ms.

Admin: session 279ms, user 283ms, token read 293ms, Slack 329ms; member bind 18ms, business query work 46ms, scope 101ms. Enrollment 1225ms includes nested provider verification: do not sum with the provider timings.

Conclusion: the current samples strongly support regional/round-trip overhead as a major previous bottleneck. Residual time is dominated by unchanged real-time provider verification. These samples are not p50/p95, browser click-to-paint timings, or guarantees under load. Baseline admin used a different browser session for the same account; content count also changed through user activity. No identity TTL introduced. Production identity, API, attachment and PDF authorization remain in place; full real Support/Ops account acceptance was not rerun here.
