# Put MarginMind online

The frontend and backend run together as one Node web service. A static website deployment alone is insufficient.

## Free link for a presentation

The existing Cloudflare tunnel runs the local presentation instance. Keep the laptop on mains power, connected to the internet, and awake; the app and tunnel processes must remain running. The current URL is temporary and can change when the tunnel restarts. There is no uptime guarantee. The presentation instance uses a separate database from the local owner workspace.

A free Render web service provides a stable service URL while your laptop is off. Its local SQLite data is temporary: idle shutdowns, restarts or deployments can erase accounts and restaurant data. It is suitable only for a disposable prototype, not reliable owner records. See https://render.com/docs/free .

1. Create a Render account at https://dashboard.render.com and connect GitHub with access to CodeGunmay/MarginMind.
2. Choose New > Web Service, select the repository and main branch.
3. Runtime: Node. Build command: `npm ci && npm run build`. Start command: `npm start`. Instance: Free.
4. Set `NODE_VERSION=24.19.0`, `NODE_ENV=production`, `DATABASE_FILE=./server/data/marginmind.db`, `APP_PROXY_HOPS=1`, `SMS_PROVIDER=mock`, `DEMO_SHOW_OTP=false`.
5. Health check: `/healthz`. Render supplies `RENDER_EXTERNAL_URL`; the app accepts that exact HTTPS origin automatically.
6. Deploy and copy the actual HTTPS URL Render assigns. Test signup, login, expenses and Action Plan at that URL before sharing it.

Mock OTP codes appear only in private server logs with these settings. They are not delivered to phones. Account creation/recovery therefore requires the operator to retrieve the test code. This is a testing workflow, not real phone verification. Public self-service phone authentication needs an implemented SMS provider and credentials. The Twilio/Firebase stubs do not send messages.

`render-free.yaml` records the free configuration for review. `render.yaml` is a PAID persistent configuration; do not apply that Blueprint unless you have approved the charge.

## Reliable records on Render

Choose the Starter service and attach a 1 GB persistent disk mounted at `/var/data`. Use `DATABASE_FILE=/var/data/marginmind.db`. The main database and sibling `restaurants/` folder must both be on the disk. Apply `render.yaml` only after approving billing. Review current prices at https://render.com/pricing . No custom domain is required; the assigned HTTPS URL works.

Set extra origins through `APP_ORIGINS` if you add a custom domain. Configure optional AI credentials only in the server environment. Real SMS sending still requires implementation and provider setup. Mock SMS is not a substitute for phone ownership verification.

## Backups

Run `npm run backup -- /path/to/new-private-backup-folder` with `DATABASE_FILE` set correctly. It uses SQLite's online backup API for the main database and each restaurant database. Snapshots are consistent individually, not one cross-database transaction. Protect backups because they contain accounts and business records. Copy them off the service; ephemeral hosting cannot preserve them.

To restore, stop the service, replace the main database and sibling restaurants folder from a backup, then restart. Never restore over a running database. Legacy accounts are already imported into the main database.

## External inputs still required

- Hosting login and any approved billing for persistent storage.
- SMS provider choice, sender approval where required, and credentials for actual sending.
- A server-side AI provider key if model-assisted extraction is wanted.
- Real menu recipes, yields, supplier prices, sales, operating bills and pantry availability to validate recommendations.
- Actual guest counts if contribution per cover should use guests instead of dish-unit proxies.
