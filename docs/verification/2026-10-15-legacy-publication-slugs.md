# Legacy publication slug compatibility — 2026-10-15

## Confirmed cause

The historical 0053 database backfill preserved fullwidth punctuation. Reading
later reapplied the current NFKC title-to-slug creation rule and rejected an
existing segment whenever normalization changed it. Both reported records were
still active and published; their sidebar links reached 404 before article lookup.

## Repair

- Decode an incoming path segment once and preserve its exact stored spelling.
- Reject malformed encoding, encoded separators, query/fragment syntax, percent
  escapes after decoding, whitespace, control characters, dot segments and
  more than 250 Unicode characters.
- Preserve stored slugs when generating URLs for published-link validation.
- Count reader path length in Unicode characters, matching the database limit.
- Keep new-document slug creation and exact database resolution unchanged.
- No production data update or SQL migration is required.

## Local evidence

The original implementation failed the two reported punctuation cases and the
historical migration/reader tests. After repair:

- `npm run verify:build`: typecheck, lint, 585 unit tests, production build and
  postbuild checks passed. The existing fixture-loader lint warning remains.
- The CI database command passed 14 tests across developers and slugs, including
  real pre-0053 records upgraded by the historical migration, authorized reads,
  ID compatibility, unchanged stored URLs and publication/audience restrictions.
- Same-title old/new publications resolve independently to the correct document;
  requests are not normalized into another article's identity.
- The slug database suite is now part of GitHub Verify.

## Production acceptance

After the exact commit is deployed, verify original links, sidebar navigation
and refresh for both `签约店铺（个人-企业）` and `为什么触发强制登录验证？`.
Confirm the deployed revision and the final GitHub verification status separately
from these local checks. Browser evidence and release status are recorded in the task.
