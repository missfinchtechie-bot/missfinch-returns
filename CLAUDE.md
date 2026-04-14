# Miss Finch NYC — Operations Hub

## What This Is
A Next.js 16 + Supabase + Tailwind v4 app deployed on Vercel at **app.missfinchnyc.com**.
Currently has a **returns management dashboard** (working, live). Expanding into a **full financial/operational dashboard** — P&L, ad spend, bank transactions, COGS, the works.

## Stack
- **Framework:** Next.js 16 (App Router) — `src/app/` directory structure
- **Database:** Supabase (Postgres) — project "MissFinch" (East US)
- **Styling:** Tailwind CSS v4 with oklch CSS custom properties (warm cream/charcoal palette)
- **Fonts:** Playfair Display (headings), Inter (body), Cormorant Garamond (serif accents)
- **Deploy:** Vercel — auto-deploys from `main` branch
- **Auth:** Simple password auth via cookie (password: missfinch2026)

## Key URLs
- Dashboard: https://app.missfinchnyc.com/admin
- Returns Portal (inactive): https://returns.missfinchnyc.com
- Supabase: https://afnnbfbuyxgtaokdortp.supabase.co
- GitHub: https://github.com/missfinchtechie-bot/missfinch-returns
- Store: https://www.missfinchnyc.com (Shopify: missfinchnyc.myshopify.com)

## Credentials (for env vars / API calls)

### Supabase
- URL: https://afnnbfbuyxgtaokdortp.supabase.co
- Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbm5iZmJ1eXhndGFva2RvcnRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0OTkxOTIsImV4cCI6MjA1ODA3NTE5Mn0.PjD0pMSwd1MfMU5K5p3XRVKJFDgJkxQx8ik-mZNJJXk
- Service role key: stored in Vercel env as SUPABASE_SERVICE_ROLE_KEY

### Shopify
- Store: missfinchnyc.myshopify.com
- Custom app: MissFinch Ops (missfinch-ops-1)
- Access token: stored in Vercel env as SHOPIFY_ACCESS_TOKEN
- API version: Use latest stable (2025-01 or 2025-04)
- GraphQL endpoint: https://missfinchnyc.myshopify.com/admin/api/2025-01/graphql.json

### Shippo (return labels only — not used for financial dashboard)
- Live key: stored in Vercel env as SHIPPO_API_KEY

### GitHub
- Repo: missfinchtechie-bot/missfinch-returns
- Push via HTTPS with token (user provides as needed)

## Current File Structure
```
src/
  app/
    admin/
      page.tsx          — Main returns dashboard (878 lines, fully working)
      layout.tsx         — Admin layout wrapper
      messages/          — Auto-reply messages dashboard (WIP)
    api/
      auth/              — Password login
      returns/           — Returns CRUD, stats, maintenance, order lookup, notes, history
      messages/          — Gmail auto-reply endpoints
      webhooks/          — Shippo + Shopify webhooks
    returns/             — Customer-facing portal (inactive)
    globals.css          — Design tokens (oklch palette)
    layout.tsx           — Root layout
    page.tsx             — Root redirect
  lib/
    supabase.ts          — Supabase client (anon + service role)
    shopify.ts           — Shopify GraphQL client (orders, refunds, gift cards, tags)
    shippo.ts            — Shippo label generation + tracking
    fees.ts              — Return fee calculation logic
    gmail.ts             — Gmail OAuth client
    ai-reply.ts          — Gemini-powered auto-reply engine
  middleware.ts          — Auth middleware
```

## Supabase Tables (existing)
- `returns` — all return records (2125 rows, imported from Redo + new)
- `timeline_events` — lifecycle events per return
- `message_log` — email auto-reply log (for messages feature)

## Design System
The app uses a warm cream/charcoal palette defined in globals.css via CSS custom properties:
- Background: warm cream (`oklch(0.98 0.005 80)`)
- Foreground: dark charcoal (`oklch(0.20 0.02 60)`)
- Cards: white, rounded-xl, shadow-sm, border with `var(--border)`
- Status badges: colored bg with matching border (emerald/amber/sky/red/purple/orange)
- Section headers: `text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold`
- Headings use `font-heading` class (Playfair Display)
- All interactive elements: rounded-xl, transition-colors

## IMPORTANT: Coding Style
- The operator has ADHD. Keep responses concise.
- Give COMPLETE files, not snippets with "find and replace" instructions.
- All pages are 'use client' with fetch-based API calls (no server components for dashboard pages).
- The operator's dad (70yo) uses this on his phone — large touch targets matter.
- Test on mobile. The detail panel uses bottom sheet on mobile, slide-right panel on desktop.

## Returns Dashboard Status
The returns system is LIVE and WORKING. Don't break it. Key features:
- Stats cards (pending refunds, credits, in transit, this week)
- Tabs: All, Action Needed, In Transit, Backlog, Completed
- Sortable table with pagination (50 per page)
- Detail panel with risk signals, timeline, customer LTV, notes, editable fields
- Real Shopify execution (refunds + gift cards)
- Maintenance endpoint auto-moves: inbox 30d+ → backlog, shipping 45d+ → lost
- Mobile-responsive with card layout on small screens

---

## FINANCIAL DASHBOARD — BUILD PLAN

### Phase 1: Shopify Financial Data (start here)
Pull from Shopify Admin API:
- **Orders**: gross revenue, net revenue, refunds, discounts, shipping collected
- **Shopify fees**: payment processing fees, Shopify subscription, app charges
- **Shipping costs**: what you paid for shipping labels
- Store in Supabase tables, synced via cron or on-demand

### Phase 2: Ad Spend
- **Meta Marketing API**: campaign spend, ROAS, CPC, CPM
- **Google Ads API**: same metrics
- Stored daily in Supabase, displayed as spend vs revenue

### Phase 3: Banking (Plaid → Chase)
- Connect Chase business account via Plaid
- Auto-categorize transactions (rent, supplies, owner draws, etc.)
- Map to expense categories in P&L

### Phase 4: COGS + Manual Entries
- SKU-level cost input (CSV upload or form)
- Wholesale invoice logging
- Manual expense entries for anything Plaid doesn't catch

### Phase 5: P&L Dashboard
- Revenue (Shopify gross → net after refunds/discounts)
- Minus: COGS
- = Gross Margin
- Minus: Ad spend (Meta + Google)
- Minus: Operating expenses (Shopify fees, apps, shipping, rent, etc.)
- Minus: Owner draws
- = Net Profit

### Dashboard Views Needed
1. **Overview** — today/week/month P&L summary, key metrics
2. **Revenue** — orders, AOV, refund rate, discount impact, channel breakdown
3. **Ad Spend** — Meta vs Google, ROAS, CAC, spend trends
4. **Expenses** — categorized spending from Plaid + manual
5. **P&L** — full profit & loss statement, MTD and trailing periods
6. **Returns** — (already built)

### Navigation
Expand the header nav from `Returns | Messages` to include financial tabs.
Keep the same warm design system. Use the existing auth system.

### Date Filtering
Every financial view needs: Today, This Week, This Month, Last Month, Last 90 Days, Custom Range.
Build this as a shared component from day one.

---

## Business Context
- ~200 orders/month, ~$25K-30K/month revenue
- ~22% return rate by revenue
- ~60/40 Meta/Google ad spend split
- Price range: $78-$228 (mostly $120-180 dresses)
- Primary customer: Orthodox Jewish women 25-45, NY/NJ
- One-person operation — this dashboard needs to save time, not create work
