# Article visible time

Apply `0055_analytics_visible_time` before deploying this release. The operator
script defaults to a read-only schema check and is restricted to the existing
JUYU project. Use its local `.env.local` configuration; never paste credentials
into logs or commit the configuration.

```sh
node --experimental-strip-types scripts/apply-analytics-visible-time.ts
node --experimental-strip-types scripts/apply-analytics-visible-time.ts --apply
```

It requires the installed `0054_slack_outbox` schema and will only install 0055.
Existing migration checksums must match. No past analytics records are rewritten.

Acceptance after release: open a published article, remain on it for at least
15 seconds, switch away, and reopen Analytics. The open count should increase
once and that visit should gain timing. Hiding the tab pauses the client clock.
Repeated timing reports keep the largest cumulative value instead of adding
them. Reports cannot update another employee's visit, and names/times remain
behind verified administrator access.

The metric means the page was visible in the foreground. It cannot prove that
someone read or understood it. Old visits have no recorded duration; averages
use only measured visits and display their sample count. Network failures and
browser suspension can undercount. Each continuous suspended gap is capped at
30 seconds, each visit at 12 hours, and reported time cannot exceed server wall
time since the accepted open.

The media library uses existing private assets and article ownership. Uploading
requires an active article outside review; archive/trash, pending and quarantined
files stay out of the library. Existing upload signature/size validation and
private delivery are unchanged. `/admin/media?article=...` remains compatible.
