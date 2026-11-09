# Class reminder service

This is a separate Cloudflare Worker at `https://attn-class-reminders.uzairaziz9427.workers.dev`; the PWA retains its existing private Sites URL. The service and D1 database are provisioned on Workers Free, and `public/reminder-service.json` points to the service. A device must still enroll and allow notifications. `/config` reports `schedulerReady` only after a real, recent cron invocation; saving a trigger does not establish scheduler readiness.

## Deployment and recovery

Run from the app checkout. Have the owner complete Cloudflare's browser authorization themselves.

1. `pnpm exec wrangler login --device --use-keyring --scopes account:read user:read workers_scripts:write d1:write` — the device flow works without a localhost callback. The owner completes consent in their browser. `workers_scripts:write` is required for script deployment; `workers:write` alone does not cover it. No billing-edit scope is requested.
2. The database is already bound in `server/wrangler.jsonc`; reuse it. Only for a fresh account without this database, run `pnpm exec wrangler d1 create attn-reminders --binding DB --update-config --config server/wrangler.jsonc`.
3. Confirm the returned database binding is saved in `server/wrangler.jsonc`. Reuse an existing database instead of creating another if this setup was already attempted.
4. `pnpm exec wrangler d1 migrations apply DB --remote --config server/wrangler.jsonc`
5. `pnpm exec wrangler deploy --config server/wrangler.jsonc`
6. Secrets are already configured; preserve them. For initial setup only, `node scripts/configure-reminder-secrets.mjs` generates keys once, sends them to Cloudflare through stdin, and stores only the device connection code in the ignored `.openai/reminder-connection.local.json`. It refuses to rotate existing secrets. No private keys go into the PWA, source, public configuration, or deployment archive.
7. Copy the exact deployed origin returned by Cloudflare into `node scripts/set-reminder-service.mjs <HTTPS_ORIGIN>`; rebuild and publish the PWA through its existing Sites workflow.
8. Check `/config` with an `Origin` header matching `APP_ORIGIN`. After the first cron invocation, `schedulerReady` must be true. A saved trigger or successful deployment alone does not prove it ran.
9. On the installed iPhone PWA, open Settings → Class reminders. Enter the private device connection code, tap Enable class reminders, and allow the iOS prompt. Tap Send a test notification and verify the actual notification on the phone. Push acceptance is not delivery confirmation.

If Cloudflare requests a paid plan, stop before accepting charges. Reuse existing resources and keys on subsequent deployments. Migrations are applied once by Wrangler; the request handler never creates tables.

## Behavior

- The same course/timetable source drives the UI and server. Updating it requires deploying this Worker as well as the frontend.
- A minute-based Cloudflare cron uses actual execution time in Asia/Karachi. Every session has an independent reminder 10 minutes before its start, including both lab sessions.
- Only the first 60 seconds after the reminder's due time are eligible. Late invocations never catch up. TTL is shortened to the remaining window and urgency is high. Exact push delivery/display remains controlled by the network and iOS.
- D1 atomically claims each class/date/device before sending. A request that times out may have been accepted already, so it is not resent. This favors avoiding duplicates and late alerts over guaranteed delivery.
- Invalid/expired push subscriptions are removed on 404/410. Test sends are rate limited. Pairing requires the private connection code, has bounded attempts, and stores only hashed device credentials.
- CORS accepts the PWA's exact origin. Management endpoints also require device authentication. Push endpoints are restricted to known browser push providers to prevent arbitrary outbound requests.
- Weekly reminders repeat until disabled; no semester end date or holiday exclusions have been supplied. Attendance notifications are not implemented.
- Cloudflare stores subscription records and send acceptance states. No portal credentials or real attendance records are involved. Logs do not print subscription endpoints, device tokens, or private keys.

## Checks

`pnpm test` checks timing boundaries, no catch-up, atomic duplicate claims against SQLite, pairing/authentication, provider validation, expired subscriptions, transport encryption/headers, and notification click routing.

`pnpm exec wrangler deploy --config server/wrangler.jsonc --dry-run` bundles and validates the Worker without publishing. Local workerd smoke testing also confirmed encrypted Web Push request generation with TTL 60, high urgency, and VAPID authentication, using a stub transport that sends nothing to a real push provider.
