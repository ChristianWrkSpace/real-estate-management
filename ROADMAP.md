# PropMan OS — Operational Roadmap

Generated 2026-05-25 at commit `799eb07`. Source of truth for what's done, what's next, and what we explicitly choose not to build (yet).

---

## ✅ Shipped — application layer is 100% stable

| Surface | Capability |
|---|---|
| Auth | Supabase email/password, owner/manager/maintenance RBAC, admin bypass script (`scripts/force-local-user.ts`) |
| Property | 1304 Rosario St (4 units), purchase price, current value, mortgage balance, interest rate, last appraisal date |
| Units | 4-unit grid with occupied/vacant/maintenance state |
| Tenants | Directory + status + drag-and-drop lease PDF upload to private `contracts` bucket |
| Leases | Tenant ↔ unit linkage, rent, deposit, document URL |
| Rent | `createRentPaymentLink(tenantId)` server action — Stripe Checkout with metadata for unit attribution |
| Stripe webhook | `/api/webhooks/stripe` — signature-verified, handles `checkout.session.completed` + `invoice.paid`, auto-inserts rent income |
| Work Orders | Glassmorphic Kanban (Open / In Progress / Resolved), New Issue modal, vendor dropdown, Resolve modal that **auto-logs a maintenance expense to the P&L on resolve** |
| Vendors | Directory of 3 starter Laredo vendors (HVAC, Plumbing, Electrical) |
| Finance / P&L | Transactions ledger, monthly summary, YTD summary, income/expense/NOI cards |
| AI Orchestrator | `lib/ai/orchestrator.ts` — cost-aware router with FAST_MODEL=`claude-haiku-4-5` and FRONTIER_MODEL=`claude-opus-4-7`, cycle-safe fallback |
| Ledger Agent | `categorizeTransaction(text)` — free-form text → typed transaction |
| Argus Agent | `runFinancialAudit()` — computes NOI/Cap Rate/Cash-on-Cash, drafts Dorsey-style narrative, persists to `ai_logs` |
| God Mode widget | Live equity, cap rate, NOI YTD, run-rate rent, expandable Argus insights with Run Audit button |
| Audit log | `ai_logs` table captures every agent invocation (model, cost, tokens, status, output) |

Build status: `npm run build` clean (15/15 routes), `tsc --noEmit` clean.

---

## 🟡 Activation-gated (waiting on 2-tab manual unblock)

These are coded and tested, just need infra:

1. **Live transactions** — `supabase/migrations/014_unified_final_repair.sql` paste recreates the dropped `transactions` table + repairs `vendors`/`work_orders` columns
2. **Live Argus audit** — Anthropic credit top-up at https://console.anthropic.com/settings/billing
3. **Stripe end-to-end** — env vars in Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`; webhook endpoint subscribed to `checkout.session.completed` + `invoice.paid`
4. **Storage RLS** — one paste of the storage.objects policy block emitted by `npx tsx scripts/init-storage.ts`

Full recovery instructions in `CLAUDE.md` → "🧊 FROZEN STATE — Recovery Log".

---

## 🎯 Next operational pipeline (post-unblock priorities)

Ranked by business leverage for a single-property owner. Each item is independently shippable.

### Tier 1 — Tenant Lifecycle Automation (highest daily leverage)

**1. Automated tenant lease flow**
- `actions/leases.ts → createDraftLease(tenantId, unitId, monthlyRent, startDate, termMonths)` — Otto agent (frontier tier) drafts a Texas-compliant residential lease from a template, fills tenant + property data, persists to `pending_approvals` for HITL signoff before send
- `actions/leases.ts → sendLeaseForSignature(leaseId)` — Resend email with the PDF + e-sign link (start with `https://docusign.com` link or hosted PDF, upgrade to DocuSeal/OpenSign self-hosted later)
- New page `/leases` — list active/expired/pending leases with one-click renewal
- Cron: `cron/lease-expiry-reminder.ts` (90/60/30/14-day windows)

**2. Move-in / move-out vision (Argus Vision)**
- `actions/inspections.ts → analyzeInspectionPhotos(unitId, photoUrls[], inspectionType)` — uses `claude-opus-4-7` vision to score condition (1–10), generate a checklist diff vs prior inspection, flag deposit-deductible damage with cost estimate
- New page `/inspections` — upload area + AI-generated condition report

**3. Tenant self-service portal (new subtree)**
- `app/(tenant)/portal/page.tsx` — tenants log in (separate role), see their unit, pay rent (Stripe link auto-generated), submit work orders, view lease PDF
- Auth: separate `tenant` role on the existing users table

### Tier 2 — Localized Laredo Public-Data Pulling

**4. Webb County tax records auto-sync**
- `actions/tax.ts → syncPropertyTax(propertyId)` — scrape https://www.webbcad.org for parcel valuation + tax bill amount/due date, store in new `property_tax_history` table
- Auto-create an `expense` transaction on tax bill posting
- Cron: monthly check + Resend email to owner before due date

**5. Laredo permit + code-violation watcher**
- `actions/permits.ts → checkPermitStatus(address)` — query City of Laredo open data portal for any open permits/violations on the address
- Alert if a violation appears — directly impacts insurability + sale value

**6. Comparable rent estimator**
- `actions/market.ts → getMarketRentEstimate(unitId)` — Otto agent pulls Zillow/Rentometer-style data for the ZIP (78040) and recommends current market rent vs current lease rent, flags units >10% under-market at renewal time

### Tier 3 — Capital / Strategic Layer

**7. Equity timeline chart on `/equity`**
- Monthly `equity_snapshots` already in schema (migration 006). Build the chart, add manual "Update Property Value" + "Update Mortgage Balance" form
- Cron: `cron/equity-snapshot.ts` first of every month

**8. Refinance-trigger alerter**
- Argus tier — analyzes current mortgage rate vs market rate, suggests refi when delta ≥ 1.0% AND remaining term ≥ 5 years
- Posts to `pending_approvals` instead of acting

**9. 1031-exchange opportunity scanner**
- When property held ≥ 12 months AND market cap rate < target, surface a 1031 candidate analysis (Argus tier)

### Tier 4 — Multi-Property Expansion (NOT a priority — single property today)

Explicit no-build list:
- ❌ Multi-tenant accounting per LLC (one property = one LLC today)
- ❌ Portfolio-level reporting (one property = no portfolio)
- ❌ Property acquisition pipeline (different product entirely)
- ❌ Mobile native app (web is mobile-friendly enough)

---

## Architectural principles for new features

1. **Server actions over API routes.** Only carve out an `app/api/.../route.ts` if external services (Stripe, cron) need to POST in.
2. **Migrations are paste-once.** New columns: always `ADD COLUMN IF NOT EXISTS`. New policies: always `DROP POLICY IF EXISTS` + `CREATE POLICY`. Every migration ends with `NOTIFY pgrst, 'reload schema'`.
3. **Every AI call writes to `ai_logs`.** No exceptions — model, cost, tokens, status, structured output. The `lib/ai/orchestrator.ts` already does this — use it instead of calling the Anthropic SDK directly.
4. **HITL by default for anything irreversible.** Lease send, contractor payment > $500, late fee, eviction → `pending_approvals` row, owner approves in `/approvals`, then the action fires.
5. **Glassmorphism is the design language.** `bg-white/[0.02]`, `backdrop-blur-2xl`, rounded-xl, gradient pills for status. See `components/GodModeWidget.tsx` for the canonical example.

---

## Open questions for the operator

These are NOT blocking — they're product decisions worth making before building Tier 1:

1. **Lease template:** custom Texas TAR form, or generic template? (Affects whether we ship a PDF rendering pipeline or just hand-stitch a `.docx`)
2. **E-signature provider:** DocuSeal (self-hosted, free) vs DocuSign (paid, polished) vs hosted PDF + click-to-agree (simplest, weakest)?
3. **Tenant portal auth:** separate sign-up, or magic-link-only (tenant clicks email → instant access)?
4. **Webb County scraping:** any rate-limit concerns / ToS issues for automated scraping? Worth checking before building (4).
