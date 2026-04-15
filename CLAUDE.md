# MISS FINCH NYC — Operations Hub
# Claude Code Megaprompt — Full Build/Fix/Polish Pass

## INSTRUCTIONS FOR CLAUDE CODE

1. Save this file as `CLAUDE.md` in the project root (replace existing)
2. Run with `--dangerously-skip-permissions` so you don't stop for approvals
3. Fix all TypeScript errors as you go
4. Run `npm run build` after each major section and fix any errors before moving on
5. Push to GitHub when done: `git push origin main`
6. The operator has ADHD — don't ask questions, make smart decisions and execute

---

## TECH STACK

- **Framework:** Next.js 16 (App Router, `src/app/` directory)
- **Database:** Supabase Postgres — project `afnnbfbuyxgtaokdortp` (East US)
- **Styling:** Tailwind CSS v4 with oklch CSS custom properties (warm cream/charcoal)
- **Charts:** Use Recharts (install if not present: `npm install recharts`)
- **Language:** TypeScript (strict)
- **Deploy:** Vercel auto-deploys from `main` branch
- **Auth:** Cookie-based password auth (password: `missfinch2026`)
- **Fonts:** Playfair Display (headings `.font-heading`), Inter (body), Cormorant Garamond (serif `.font-serif`)

## DESIGN SYSTEM — DO NOT DEVIATE

The app uses a warm cream/charcoal palette. All colors come from CSS custom properties in `globals.css`:

```
--background: oklch(0.98 0.005 80)     /* warm cream */
--foreground: oklch(0.20 0.02 60)      /* dark charcoal */
--card: oklch(1 0 0)                    /* white */
--primary: oklch(0.25 0.02 60)         /* near-black */
--primary-foreground: oklch(0.97 0.005 80) /* cream text on dark */
--muted: oklch(0.96 0.008 80)          /* light cream for bg areas */
--muted-foreground: oklch(0.50 0.02 60) /* medium gray text */
--accent: oklch(0.92 0.02 80)          /* hover states */
--border: oklch(0.90 0.01 80)          /* subtle borders */
--ring: oklch(0.45 0.03 60)            /* focus rings */
```

**Design rules:**
- Cards: `bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm`
- Section headers: `text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold`
- Status badges: colored bg with matching border, `rounded-lg`, `text-[10px] font-semibold px-2 py-0.5`
- Buttons: `rounded-xl` with appropriate padding, `transition-colors` or `transition-opacity`
- Inputs: `rounded-xl border border-[var(--border)] focus:border-[var(--ring)] bg-[var(--card)]`
- No hard-coded grays — use `var(--muted-foreground)`, `var(--border)`, `var(--muted)`, etc.
- Mobile: detail panels use bottom sheets (`.animate-slide-up`), desktop uses slide-right panels
- Your dad (70yo) uses this on his phone — LARGE touch targets (min 44px), readable font sizes
- Reference Linear, Stripe, Triple Whale for design quality — NOT generic dashboard templates

---

## URLS & CREDENTIALS

- **Dashboard:** https://app.missfinchnyc.com
- **Supabase:** https://afnnbfbuyxgtaokdortp.supabase.co
- **Supabase Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbm5iZmJ1eXhndGFva2RvcnRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0OTkxOTIsImV4cCI6MjA1ODA3NTE5Mn0.PjD0pMSwd1MfMU5K5p3XRVKJFDgJkxQx8ik-mZNJJXk
- **Supabase Service Role:** stored in Vercel env as `SUPABASE_SERVICE_ROLE_KEY`
- **Shopify Store:** missfinchnyc.myshopify.com
- **Shopify Token:** stored in Vercel env as `SHOPIFY_ACCESS_TOKEN`
- **Shopify API Version:** 2026-04
- **GitHub:** missfinchtechie-bot/missfinch-returns

---

## DATABASE SCHEMA (current, live in Supabase)

### returns (2,125 rows)
```
id uuid PK, return_number text, shopify_order_id text, shopify_return_id text,
order_number text, customer_id uuid FK→customers, customer_name text, customer_email text,
status text ['inbox','shipping','old','done'], type text ['refund','credit','exchange'],
outcome text ['refund','credit','rejected','lost', null],
reason text, reject_reason text,
subtotal numeric(default 0), fee_per_item numeric(0), total_fees numeric(0),
bonus_amount numeric(0), final_amount numeric(0), paid_with text('card'),
item_count int(1), easypost_shipment_id text, tracking_number text, tracking_status text,
label_url text, order_date timestamptz, delivered_to_customer timestamptz,
return_requested timestamptz, label_sent timestamptz, customer_shipped timestamptz,
delivered_to_us timestamptz, processed_at timestamptz,
is_flagged bool(false), flag_reason text, imported_from text, redo_id text,
created_at timestamptz, updated_at timestamptz
```

**Status flow:** shipping → inbox (when delivered) → done (when processed) OR old (30+ days no action)
**Maintenance (runs on dashboard load):** inbox 30d+ → old (backlog), shipping 45d+ → done/lost

### return_items
```
id uuid PK, return_id uuid FK→returns, shopify_line_item_id text,
product_name text, sku text, size text, price numeric, image_url text, created_at timestamptz
```
Note: Only populated for new portal returns. Redo imports have NO return_items rows.

### customers (1,509 rows)
```
id uuid PK, shopify_customer_id text, name text, email text, address text, city text,
total_orders int(0), total_returns int(0), total_items_returned int(0),
total_value_returned numeric(0), lifetime_spend numeric(0), net_revenue numeric(0),
return_rate numeric(0), is_flagged bool(false), flag_reason text,
created_at timestamptz, updated_at timestamptz
```
Note: `total_orders` and `lifetime_spend` are 0 for all customers — never backfilled from Shopify. This needs fixing.

### timeline_events
```
id uuid PK, return_id uuid FK→returns, event text, detail text,
event_date timestamptz, created_at timestamptz
```

### message_log
```
id uuid PK, gmail_id text, thread_id text, from_email text, from_name text,
subject text, body_preview text, category text, confidence numeric,
auto_send bool(false), draft_reply text, reasoning text,
status text('pending_review'), sent_at timestamptz, created_at timestamptz
```

### shopify_orders (empty — needs sync)
```
id text PK, order_number bigint, name text, created_at timestamptz, processed_at timestamptz,
cancelled_at timestamptz, financial_status text, currency text('USD'),
subtotal_price numeric(0), total_price numeric(0), total_tax numeric(0),
total_discounts numeric(0), total_shipping numeric(0), total_refunded numeric(0),
customer_id text, customer_email text, tags text, test bool(false), synced_at timestamptz
```

### shopify_refunds (empty — needs sync)
```
id text PK, order_id text FK→shopify_orders, created_at timestamptz, processed_at timestamptz,
amount numeric(0), currency text('USD'), note text, synced_at timestamptz
```

### shopify_transactions (empty — needs sync)
```
id text PK, order_id text, created_at timestamptz, type text,
amount numeric(0), fee numeric(0), net numeric(0), currency text('USD'),
source_type text, source_id text, payout_id text, synced_at timestamptz
```

### settings
```
id uuid PK, key text, value jsonb, updated_at timestamptz
```

### influencers
```
id uuid PK, created_at timestamptz, updated_at timestamptz, created_by text,
instagram_handle text NOT NULL, profile_url text, follower_count int, engagement_rate numeric(5,2),
niche_tags text[], content_types text[], bio_notes text, already_contacted bool(false),
status text('pending_review') ['pending_review','approved','declined','deal','shipped','content_pending','posted','complete'],
status_changed_at timestamptz, declined_reason text,
deal_type text, payment_amount numeric(10,2), products_to_send jsonb, deliverables text,
expected_post_date date, special_instructions text, discount_code text, shipping_address jsonb,
shopify_draft_order_id text, shopify_order_id text, shopify_order_name text, shopify_fulfillment_status text,
content_urls text[], content_posted_date date, content_type_posted text[],
post_reach int, post_impressions int, post_engagement int, post_shares int, post_video_views int
```

### influencer_notes
```
id uuid PK, created_at timestamptz, influencer_id uuid FK→influencers,
user_name text, user_role text, note_text text
```

### influencer_activity_log
```
id uuid PK, created_at timestamptz, influencer_id uuid FK→influencers,
user_role text, action text, details jsonb
```

---

## CURRENT FILE STRUCTURE

```
src/
  app/
    admin/
      page.tsx              — Returns dashboard (~1036 lines, WORKING)
      layout.tsx            — Admin layout wrapper
      messages/page.tsx     — AI email triage (~240 lines, WORKING)
      financials/page.tsx   — Financial overview (~348 lines, PARTIALLY WORKING)
      analytics/page.tsx    — Returns analytics (~230 lines, WORKING)
      influencers/page.tsx  — Influencer tracker (pipeline, deals, Shopify drafts)
    api/
      auth/                 — Password login (GET check, POST login)
      returns/              — Returns CRUD, stats, maintenance, order lookup, notes, history, analytics, items, update
      messages/             — Gmail auto-reply: cron, list, send
      financials/           — Shopify financial sync, overview, cron
      webhooks/             — Shippo tracking + Shopify webhooks
    returns/                — Customer-facing portal (INACTIVE, ignore)
    globals.css             — Design tokens
    layout.tsx              — Root layout
    page.tsx                — Root redirect
  lib/
    supabase.ts             — Supabase client (anon + service role)
    shopify.ts              — Shopify GraphQL (orders, refunds, gift cards, tags)
    shopify-financial.ts    — Shopify financial data sync
    fees.ts                 — Return fee engine (5% restock on refunds, 5% bonus on credits)
    shippo.ts               — Shippo label generation + tracking
    gmail.ts                — Gmail OAuth client
    ai-reply.ts             — Gemini auto-reply engine
  middleware.ts             — Auth middleware
```

---

## PAGES — WHAT EACH SHOULD LOOK LIKE WHEN DONE

### 1. /admin (Returns Dashboard) — MOSTLY DONE, NEEDS POLISH

**Current state:** Working. 1036 lines. Warm palette. Functional.

**What needs fixing/adding:**
- The nav bar is duplicated across all 4 pages with slightly different code. Extract a shared `<Nav active="returns" />` component.
- ALL pages need a date range selector. The returns dashboard currently has none — add one at the top (Today / This Week / This Month / Last Month / Last 90 / Custom). Filter the returns list by `return_requested` date.
- Stats cards should update based on the selected date range, not always show all-time.
- The In Transit tab should default sort by `customer_shipped` ascending (oldest first) so the most overdue packages are at the top.
- The Backlog tab (old) should show a small info banner: "Returns delivered 30+ days ago with no action. Process or reject to clear."
- The detail panel's "Returned Items" section fetches from `return_items` table. For Redo imports (no return_items), it shows a fallback message — this is correct, leave it.
- The fee breakdown above action buttons is correct (5% restock on refunds, 5% bonus on credits). Don't change the fee logic.
- Add a small "Export CSV" button on the table that exports the current filtered view.

### 2. /admin/messages (AI Email Triage) — WORKING, NEEDS POLISH

**Current state:** Working. Warm palette. Desktop has sidebar + detail layout, mobile has bottom sheet.

**What needs fixing:**
- No date range — add one. Filter messages by `created_at`.
- The mobile bottom sheet exists but test it carefully — the message list should scroll independently.
- Add a count badge next to "Messages" in the nav showing pending count.
- The category badges are fine. The AI reasoning section is fine.
- Make sure the "Check Inbox" button shows a loading spinner, not just text change.

### 3. /admin/financials (Financial Dashboard) — PARTIALLY WORKING

**Current state:** Has date range selector and revenue cards pulling from Shopify sync. Has mock ad spend, expenses, and P&L sections tagged with "Mock Data" badges. The Shopify sync may fail if `SHOPIFY_ACCESS_TOKEN` env var is missing in Vercel.

**What needs fixing:**
- The bar chart for daily revenue is custom-built with divs. Replace with Recharts `<BarChart>` for proper tooltips, axes, and responsiveness. Use `<Bar>` with `stackId` for revenue vs refunds.
- The mock data sections (Ad Spend, Expenses, P&L) are fine as placeholders — leave them but make sure they look good.
- Add a "Last synced: [timestamp]" indicator near the Sync button.
- The P&L section should be collapsible/expandable.
- Every metric should have a formula tooltip (ⓘ hover) like the analytics page. Show exactly how each number is calculated.

### 4. /admin/analytics (Returns Analytics) — WORKING, NEEDS MORE

**Current state:** Working with real Supabase data. Formula tooltips on every metric. Monthly chart, type/outcome breakdown, day-of-week, repeat returners.

**What needs fixing:**
- **ADD DATE RANGE SELECTOR.** Currently shows all-time. Needs the same Today/Week/Month/Last Month/90d/Custom selector. All data should filter by the selected range.
- The monthly chart uses custom div bars. Replace with Recharts `<BarChart>` with stacked bars, proper Y axis labels, X axis month labels, and tooltips.
- The day-of-week chart should also use Recharts.
- Add a "Return Rate" section: calculate return rate as (returns / orders) per month. This requires data from `shopify_orders` table. If that table is empty (sync not run yet), show "Sync Shopify data to see return rate" placeholder.
- Add "Avg Days to Return" metric: AVG(return_requested - delivered_to_customer) for returns where both dates exist.
- Add "Avg Days to Process" metric: AVG(processed_at - delivered_to_us) for returns where both dates exist.
- The repeat returners table should be linkable — clicking a name should filter the returns dashboard to that customer (pass as URL param).

---

## SHARED COMPONENTS TO EXTRACT

Create `src/components/` directory with:

### `Nav.tsx`
Shared navigation component used by all 4 pages. Props: `active: 'returns' | 'messages' | 'financials' | 'analytics'`. Shows pending message count badge on Messages tab. Shows the Miss Finch logo, NYC text, and the pill nav bar. Currently duplicated across 4 pages with slight differences — consolidate into one.

### `DateRangeSelector.tsx`
Shared date range picker. Props: `preset`, `onPresetChange`, `customFrom`, `customTo`, `onCustomChange`. Presets: Today, This Week, This Month, Last Month, Last 90 Days, Custom. Used on all 4 pages.

### `MetricCard.tsx`
Shared stat card component. Props: `label`, `value`, `sub?`, `formula?`, `trend?`, `accent?`. Includes the formula tooltip (ⓘ) on hover. Used everywhere.

### `Tooltip.tsx`
The formula tooltip component. Props: `text: string`. Shows ⓘ icon that reveals explanation on hover. Already built inline in analytics page — extract it.

---

## RETURN FEE LOGIC (DO NOT CHANGE)

Located in `src/lib/fees.ts`. The rules:
- **Refund:** 5% restocking fee. Customer gets subtotal × 0.95.
- **Credit:** Free. Plus 5% bonus on card-paid orders (max $25, 2x per customer per 90 days).
- **Exchange:** Free. Processed as credit.

The action buttons in the detail panel show a fee breakdown card BEFORE the button:
```
Return value:          $200.00
Restocking fee (5%):   -$10.00
─────────────────────
Refund amount:         $190.00
[Approve Refund · $190.00]
```

The API at `/api/returns` PATCH stores `total_fees`, `fee_per_item`, `bonus_amount` on the return record.

---

## RETURN POLICY WINDOWS
- Refund: 7 days from delivery
- Credit: 14 days from delivery
- Exchange: 14 days from delivery
- All refunds require manual approval
- Return address: 224 W 35th St Ste 1400, NYC 10001

---

## KEY DATA FACTS (verified from database)

- 2,125 total returns, $359K total value
- 180 returns have $0 value (rejected Redo imports — exclude from averages)
- Avg return value: $185 (excluding $0), $169 (including)
- 35.1% rejection rate (549 rejected / 1,566 completed)
- Status: 1,566 done, 512 old (backlog), 38 inbox, 9 shipping
- Outcomes: 638 refunded, 549 rejected, 360 credited, 19 lost
- Types: ~56% refund, ~12% exchange, ~7% credit
- Wednesday peak (406 returns), Saturday lowest (156) — Shabbat effect
- March 2026 worst month: 106 returns, $29.6K
- Top repeat returner: Valentina Pasechnik (24 returns, $3,439)
- Customer table: 1,509 customers but lifetime_spend and total_orders are all 0 (never backfilled)

---

## KNOWN BUGS / ISSUES TO FIX

1. **No date filtering on returns dashboard** — returns tab shows all-time data with no date range selector
2. **No date filtering on analytics** — shows all-time, no way to see "this month" returns analytics
3. **Customers table has 0 for lifetime_spend** — needs backfilling from Shopify (use shopify_orders table or direct API calls during sync)
4. **shopify_orders/refunds/transactions tables are empty** — the sync API exists but tables may not have been populated if SHOPIFY_ACCESS_TOKEN env var was missing
5. **Nav is duplicated** across 4 pages — should be a shared component
6. **Charts are custom div bars** — replace with Recharts for proper interactivity
7. **In Transit tab default sort** should be oldest-first (most overdue at top)
8. **No export** — add CSV export for the returns table
9. **No "Avg Days to Return"** or "Avg Days to Process" metrics in analytics
10. **Messages page** doesn't show pending count in the nav from other pages

---

## WHAT NOT TO TOUCH

- `/api/returns` PATCH endpoint (processes real Shopify refunds/credits)
- `/api/returns/order` (Shopify GraphQL order lookup)
- `src/lib/shopify.ts` (working Shopify client)
- `src/lib/fees.ts` (correct fee engine)
- `src/lib/gmail.ts` and `src/lib/ai-reply.ts` (Gmail auto-reply — not activated yet)
- `src/app/returns/` (customer portal — inactive, ignore entirely)
- The auth system (cookie-based, works fine)
- The Shippo webhook handler
- The maintenance endpoint logic (30d backlog, 45d lost)

---

## PRIORITY ORDER

1. Extract shared components (Nav, DateRangeSelector, MetricCard, Tooltip)
2. Add date range filtering to returns dashboard + analytics
3. Replace div charts with Recharts on analytics + financials
4. Add missing analytics metrics (avg days to return, avg days to process)
5. Fix In Transit default sort
6. Add CSV export to returns table
7. Polish all loading/empty states
8. Add formula tooltips to financials page
9. General UI polish pass — spacing, typography, consistency
10. Run `npm run build` and fix all TypeScript errors
11. Push to GitHub

---

## BUSINESS CONTEXT

- Miss Finch NYC: modest fashion brand, ~$78-228 dresses
- ~200 orders/month, ~20-30 returns/month
- Primary customer: Orthodox Jewish women 25-45, NY/NJ
- One-person operation — this dashboard must save time, not create work
- The operator's dad (70yo) processes returns on his phone — large touch targets, clear data
- Returns are currently handled via Redo ($596/mo) — this dashboard will eventually replace it
- The financial dashboard will eventually replace Triple Whale
