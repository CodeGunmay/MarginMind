# Current release: 13 October 2026

Completed: authenticated owner workspaces, OTP signup/recovery, private ingredients/recipes/sales, menu analysis, scenarios, operating expense entry/corrections, estimated operating profit and break-even.

Verified: 56 owner/API checks, 29 OTP checks, typecheck and production build. Public presentation-instance API smoke checks cover mock OTP signup, verification, password login, restaurant data and expense endpoints using Secure HttpOnly cookies. Full interactive browser workflows and external integrations are not exhaustively verified.

No genuine restaurant records or credentials are included. New accounts start empty. The short-lived Cloudflare presentation URL is a separate local instance and is not a persistent deployment.

Remaining: real SMS provider implementation, live AI verification, customer-segment analysis, replacement suggestions, action-plan comparisons, restaurant pilot and durable hosting. Bundling currently emits a large-chunk warning; this does not fail the build.

Dependency audit: 10 reported advisories (4 moderate, 6 high). Dependency remediation is pending; no claim of a security-clean production release. Fresh npm ci, typecheck, 10 basic server-render checks and build pass.
