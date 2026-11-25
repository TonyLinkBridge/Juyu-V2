# Knowledge-base Slack notifications

The existing **Juyu V2** Slack app sends workflow notices to the private
`#知识库沟通群` channel. Slack sign-in still uses Clerk and is independent of this
outbound bot connection.

The bot needs only `chat:write` and membership in the target channel. It does
not need channel-history, user-token, or public-channel posting scopes. Set
`SLACK_BOT_TOKEN` as a Vercel Production Secret and
`SLACK_NOTIFICATION_CHANNEL_ID` to that channel's ID. Set `CRON_SECRET` as a
separate Production Secret for Vercel's retry cron. Never store these secrets
in source control or expose them to client-side code.

The application queues one notice for submission, approval, rejection, initial
publication, publication of an update, and the first edit of an already
published document. Ordinary autosaves do not notify. Notices contain a type,
title, actor, and application link; they never include article body. Titles
from restricted audiences or categories are replaced with `受限资料`. The link
still requires the reader's normal application permissions.

The queue is committed with the article audit entry, then delivery runs after
the response. Failed Slack sends retry with a bounded backoff, and Vercel's
five-minute cron drains pending records. The authenticated cron route is
`/api/cron/slack-notifications`. If `CRON_SECRET` is absent, it refuses the
request. If the bot is missing from the private channel, Slack reports
`not_in_channel`; invite the app before testing a notification.

Before deploying code that enqueues notices, apply `0054_slack_outbox` to the
production database with `npm run db:migrate:slack -- --apply`. The migration
is additive and is not run on application startup.
