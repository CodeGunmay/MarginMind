# MarginMind

**Know what sells. Know what pays.**

AI-powered Menu Engineering & Dish Profitability platform for hotels, restaurants and cafés — built as a 24-hour AI hackathon prototype. It turns recipes, ingredient costs and sales data into smarter restaurant decisions: **Data → Analysis → Intelligence → Action → Profitability.**

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

No logins, API keys, backend or database required — the app runs entirely on a seeded local dataset (**Musafir Cafe, Dehradun**) with client-side state.

## What's inside

| Area | Highlights |
|---|---|
| **Dashboard** | 6 KPI cards with deltas, Menu Health quadrants (click-through), Revenue vs Contribution chart (metric toggles), Top Profit Leaks, MarginMind AI insight |
| **Menu Intelligence** | Full sortable/filterable dish table + interactive 2×2 **Menu Engineering Matrix** (bubble = revenue, hover details, click-through, AI Strategy generator) |
| **Dish Analysis** | Price/cost/food-cost/contribution breakdown, 7/30/90-day trends, recipe cost structure, "why this classification?" + recommended action + confidence (labelled demo heuristic) |
| **Recipe Costing** | Live cost engine — add/edit/delete ingredients, servings, wastage, price; inline global ingredient price edits that recalculate every dish; plain-English **AI ingredient extraction** + simulated recipe-image OCR |
| **Sales Analytics** | 7/30/90-day revenue/units/contribution trends, top & bottom 10, category pies |
| **Ingredient Costs** | Price-change tracking, change %, used-in counts, monthly margin impact, expandable "affected dishes" per ingredient |
| **AI Recommendations** | Deterministic rules engine over live metrics — Pricing / Recipe / Promotion / Placement / Ingredient / Removal cards with **Problem → Evidence → Action → Estimated Impact**, one-click price application |
| **Profit Leak Detector** | High-volume-low-margin, ingredient spikes, high food cost, declining contribution — severity + ₹ impact |
| **Optimize My Menu** | Prioritized promote/reprice/re-engineer/reposition/monitor/remove action plan |
| **Scenario Simulator** | Price / ingredient inflation / portion / volume levers + presets, Current vs Projected comparison table & chart |
| **Ingredient Alternatives** | Substitution suggestions with cost deltas and chef-validation disclaimers |
| **Menu Description Generator** | Template-based menu copy from each dish's real ingredient profile (Generate / Regenerate / Copy) |
| **Reports** | Printable monthly profitability report (PDF via print) + full CSV export |
| **Ask MarginMind** | Floating copilot — deterministic answers referencing real dishes & metrics (e.g. "What happens if chicken prices increase 10%?") |
| **Settings** | Restaurant profile, currency, tax, food-cost target, popularity & profitability thresholds — **classifications recalculate live** |

## Demo data honesty

All AI features are a **deterministic local rules engine** over the seeded dataset — no external model calls. Predictions are labelled *Estimated / Projected / Demo*. The dataset spans all four menu-engineering quadrants. Settings persist in this browser; recipe and ingredient edits reset on page reload. This prototype has no shared database or restaurant integrations.

## Stack

React 18 · TypeScript · Vite 6 · Tailwind CSS 3 · Recharts · lucide-react · React Router 7

## Live demo

https://margin-mind-mm.netlify.app/

## Deploy to Netlify

Import this repository in Netlify. The included `netlify.toml` sets the build command to `npm run build`, the publish directory to `dist`, and Node.js to version 22. `public/_redirects` supports direct links and reloads on every React Router page.

For a manual deployment, run `npm ci` followed by `npm run build`, then upload the `dist` folder. Publishing this repository does not update an existing Netlify deployment unless it is connected to the repository or the new build is uploaded.

## Validation

`npm run typecheck` checks TypeScript. `npm run build` runs that check and produces the website files. Use Node.js 22 for local development.

The original simulator used the selected dish object in the monthly contribution change cell; this version uses the numeric contribution difference. React type definitions and Netlify configuration are included, and the router dependency has been updated.

Dependency audit still reports issues in the Tailwind 3 build-tool dependency chain. A Tailwind 4 migration requires separate visual checks. The app remains a client-side demonstration, with simulated AI and sales trends.
