# MarginMind

Restaurant menu costing and business profitability workspace for small restaurants and cafes. React + TypeScript frontend, Express backend and private SQLite restaurant databases.

## Run locally

Use Node.js 24 LTS and npm. From this repository:

```sh
npm ci
```

Copy `.env.example` to `.env`. For local OTP testing, set `SMS_PROVIDER=mock` and `DEMO_SHOW_OTP=true`; otherwise codes appear only in the server console. These codes simulate SMS and do not establish real phone ownership.

```sh
npm run dev:all
```

Open http://localhost:5173. Signup requires a name, Indian mobile number and password (at least 10 characters), then OTP verification. Normal login uses phone + password without OTP. Password recovery verifies an OTP and revokes all previous sessions.

For the built frontend and API on one port:

```sh
npm run build
npm start
```

Open http://localhost:4000. `npm run preview` serves only the frontend; it does not start the backend. Set `APP_ORIGINS` to the exact origin(s) you use.

## Current features

- OTP signup and password recovery; bcrypt password hashes, hashed expiring single-use OTPs, resend/attempt limits, HttpOnly cookie sessions.
- Separate restaurant data for each account. New accounts start with empty menus and ingredients.
- Restaurant setup, owner-entered purchase prices, recipes, cost validation, actual sales entry and CSV import.
- Menu classification by sales and contribution, rule-based guidance, price/portion scenarios and printable reports.
- Business type/location, fixed and variable monthly expenses, expense corrections, estimated operating profit and break-even.
- Reviewed English recipe OCR and deterministic text parsing. Optional model-assisted extraction/explanations need server-side credentials.

## How to use the app

Create an account, save your restaurant details, enter ingredients and purchase prices, create recipes and selling prices, then record dated sales. Add operating expenses through Expenses & Profit. Enter rent and other recurring bills for each month. Avoid double-counting costs already included in recipes.

Location supplies context; the app does not invent city prices. Menu categories and scenarios rely on recorded inputs. Dish overhead allocation uses revenue share, not activity-based costing. Profit and break-even are estimates before tax, financing and unrecorded costs. Scenarios do not predict customer demand or prove actual profit improvements.

## Verify

```sh
npm run typecheck
npm run test:owners
npm run test:otp
npm run test:mentor
npm run test:render
npm run build
```

The owner suite covers 56 API checks, including account isolation, historical sales, recipe costs, operating expenses, break-even and restart persistence. The OTP suite covers 29 checks, including expiration, wrong codes, rate limits, password recovery and session revocation. Tests create disposable databases in ignored `verification-data/`.

## Hosting and data

Deploy as a Node web service that runs `npm ci`, `npm run build` and `npm start`. Use HTTPS, `NODE_ENV=production`, and `APP_ORIGINS` set to the exact public website origin. Store `DATABASE_FILE` and its sibling `restaurants/` directory on persistent storage, with backups. Existing sibling `accounts.db` is imported once for legacy account preservation. Credentials belong only in server environment variables.

Do not commit `.env`, database files, uploads, or private restaurant data. Production Secure cookies require HTTPS. A static frontend hosting service alone does not run this backend or preserve SQLite data.

## Current limitations

SMS is mocked by default. Twilio and Firebase are credential-reading stubs and do not send messages. External AI calls and microphone workflows need hands-on verification. Business profiles, sensitivity-capped recommendations and the monthly Action Plan are implemented. Restaurant pilots and measured profit improvements remain pending. This repository is a working progress build, not a claim of production readiness.

## Mentor-feedback update

Settings now includes establishment type, area, customer segment and editable price sensitivity. Save the profile to set a default food-cost target; the owner can fine-tune that target afterward. Suggested price increases are capped at 5%, 10% or 15% for high, medium or low sensitivity. Hospitality planning defaults live in `server/hospitality-defaults.json`; edit them deliberately and restart the service. These assumptions are not learned demand models.

Action Plan gives costed price/ingredient-quantity trials per dish. Dogs can be replaced by higher-contribution existing recipes in the same category if at least 80% of both ingredient lines and ingredient cost are confirmed in stock. No recipe or price is invented. Ingredient availability must be confirmed by the owner; stock quantity and depletion are not tracked.

Select one action per dish to compare recorded monthly revenue, direct recipe cost %, contribution per cover proxy and operating profit. The default transfer assumption is 60%, editable from 0% to 100%; sales move within the category, weighted by recorded sales or equally if none exist. Lost sales are removed. Fixed expenses stay constant and variable expenses scale at the recorded revenue rate. No menu edits or sales changes occur from selecting actions. Taste, portion adequacy, demand changes, taxes and unrecorded costs require owner review. One dish unit proxies one cover; actual guest counts are not recorded.

Additional verification: 48 mentor-feedback API checks and 12 basic server-render checks. Production-dependency audit reports zero known advisories at the time of this update; 7 development-tooling advisories remain and need a build-tool migration. See HOSTING.md for free temporary hosting limits, paid persistence, and private SQLite backups.
