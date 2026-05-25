# PropMan OS — Real Estate Management System

## Project Overview

A property management operating system for **1304 Rosario St, Laredo TX 78040** — a 4-unit residential property owned under Trinity Home Builders LLC.

**Philosophy:** Jack Dorsey simplicity (no bloat) + Elon brute-force reliability (fail-closed, unbreakable) + Diamandis moonshot (AI drives workflow, humans approve what matters).

---

## Core Requirements

### Must-Have
- ✅ Units management (4 units: occupied/vacant/maintenance)
- ✅ Tenants directory (name, email, phone, status)
- ✅ Leases (link unit + tenant, monthly rent, security deposit)
- ✅ Rent collection tracker (due dates, payment status)
- ✅ Work orders (create, assign contractor, track cost)
- ✅ Contractors directory (name, specialty, rates)
- ✅ Dashboard KPIs (occupancy %, rent collected, work orders, equity)
- 🔄 P&L tracking (income vs expenses by month)
- 🔄 Equity tracker (property value, mortgage, LTV ratio)
- 🔄 Contracts vault (lease PDFs, vendor contracts)
- 🔄 Approvals queue (HITL — human-in-the-loop)

### AI Layer
- **Model-agnostic:** Works with any provider (Claude, GPT, Gemini, DeepSeek, Groq, Mistral)
- **Agents:** Otto (leases), Ledger (P&L), Argus (vision/photos), Dispatch (work orders)
- **HITL gates:** Lease drafts, contractor payments, late fees, evictions

---

## Tech Stack

```
Frontend:         Next.js 16 + React 19 + TypeScript
Styling:          Tailwind CSS v4 + glassmorphism
Backend:          Supabase (PostgreSQL) + server actions
Authentication:   Supabase Auth (email/password)
AI:               Anthropic SDK (multi-provider abstraction)
Storage:          Supabase Storage (PDFs, photos)
Payments:         Stripe (rent collection, contractor payments)
Email:            Resend (notifications)
Deployment:       Vercel
```

---

## Project Structure

```
real-estate-management/
├── app/
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Root → redirect to /dashboard or /login
│   ├── login/page.tsx               # Login page (enhanced UI)
│   ├── (dashboard)/
│   │   ├── layout.tsx               # Sidebar + auth guard
│   │   ├── dashboard/page.tsx       # KPI command center
│   │   ├── units/page.tsx           # Unit grid (4 cards)
│   │   ├── units/[id]/page.tsx      # Unit detail (lease, tenant, history)
│   │   ├── tenants/page.tsx         # Tenant table
│   │   ├── tenants/[id]/page.tsx    # Tenant detail
│   │   ├── rent/page.tsx            # Rent tracker + payment links
│   │   ├── work-orders/page.tsx     # Work order list
│   │   ├── work-orders/new/page.tsx
│   │   ├── work-orders/[id]/page.tsx
│   │   ├── contractors/page.tsx     # Contractor directory
│   │   ├── contractors/[id]/page.tsx
│   │   ├── contracts/page.tsx       # Contract vault
│   │   ├── finances/page.tsx        # P&L by month
│   │   ├── equity/page.tsx          # Equity chart
│   │   └── approvals/page.tsx       # HITL queue
│   ├── actions/
│   │   └── auth.ts                  # Server actions: signIn, signOut
│   ├── api/
│   │   ├── stripe/webhook/route.ts  # Stripe payment confirmations
│   │   └── cron/
│   │       ├── rent-reminder.ts     # Monthly rent-due reminders
│   │       └── equity-snapshot.ts   # Monthly equity calculation
│   └── auth/callback/route.ts       # Supabase OAuth callback
├── lib/
│   ├── supabase.ts                  # Browser client (public key)
│   ├── supabase-server.ts           # Server client (service role)
│   ├── auth-helpers.ts              # getCurrentUser() + requirePermission()
│   ├── permissions.ts               # Roles: owner | manager | maintenance
│   ├── ai-client.ts                 # Multi-provider AI abstraction
│   ├── ai-provider.ts               # Model registry + cost calc
│   ├── local-auth.ts                # DEPRECATED: local auth (remove)
│   ├── local-db.ts                  # DEPRECATED: local db (remove)
│   ├── otto.ts                      # AI agent: lease drafting
│   ├── ledger.ts                    # AI agent: P&L analysis
│   ├── argus.ts                     # AI agent: vision (photos)
│   ├── dispatch.ts                  # AI agent: work order drafting
│   ├── stripe.ts                    # Stripe utilities
│   ├── resend.ts                    # Email notifications
│   ├── auto-actions.ts              # HITL queue logic
│   ├── agent-feedback.ts            # AI agent feedback system
│   └── nav.ts                       # Navigation config
├── components/
│   ├── ui/Glass.tsx                 # Glassmorphic card component
│   ├── RoleGate.tsx                 # Permission-based rendering
│   ├── UnitCard.tsx
│   ├── RentStatusBadge.tsx
│   └── WorkOrderCard.tsx
├── supabase/
│   └── migrations/
│       ├── 001_core.sql             # properties, units, tenants, leases
│       ├── 002_rent.sql             # rent_payments, stripe
│       ├── 003_work_orders.sql      # work_orders, contractors
│       ├── 004_contracts.sql        # contracts (lease, vendor, etc)
│       ├── 005_finances.sql         # property_expenses
│       ├── 006_equity.sql           # equity_snapshots (monthly)
│       ├── 007_ai_infra.sql         # agents, approvals, audit logs
│       └── 008_rls.sql              # RLS policies + security
├── .env.local                       # Supabase keys (NEVER commit)
├── CLAUDE.md                        # This file
├── package.json
└── vercel.json
```

---

## Database Schema (Supabase PostgreSQL)

### Core Tables (Migration 001)
- **properties** — 1304 Rosario St (address, units_count, current_value, mortgage_balance, owner_entity)
- **units** — 4 units (unit_number, bedrooms, bathrooms, status, monthly_rent)
- **tenants** — resident directory (first_name, last_name, email, phone, status)
- **leases** — unit ↔ tenant (start_date, end_date, monthly_rent, security_deposit, status)

### Rent Tables (Migration 002)
- **rent_payments** — monthly tracking (due_date, amount_due, amount_paid, payment_method, stripe_payment_intent_id, status)

### Work Orders (Migration 003)
- **contractors** — directory (company_name, contact_name, phone, email, specialty, rate_type, hourly_rate)
- **work_orders** — (title, description, category, priority, status, estimated_cost, actual_cost, contractor_id)
- **contractor_payments** — (work_order_id, contractor_id, amount, payment_method, status)

### Contracts (Migration 004)
- **contracts** — vault (contract_type, title, parties, start_date, end_date, auto_renews, document_path)

### Finances (Migration 005)
- **property_expenses** — (category, description, amount, expense_date, is_recurring, vendor)

### Equity (Migration 006)
- **equity_snapshots** — monthly (snapshot_date, property_value, mortgage_balance, equity, ltv, gross_rent_income, total_expenses, noi)

### AI Infrastructure (Migration 007)
- **agent_invocations** — log (agent, model, task, tokens_in, tokens_out, cost_usd, error)
- **agent_outcomes** — feedback (agent, task, outcome, delta)
- **pending_approvals** — HITL queue (kind, entity_type, entity_id, link, status)
- **audit_logs** — append-only (user_id, action, entity_type, entity_id, details)

### RLS (Migration 008)
- All tables have RLS enabled
- Owner sees everything
- Manager sees all (except audit, agents)
- Maintenance sees only work_orders

---

## Permissions Matrix

| Permission | owner | manager | maintenance |
|---|---|---|---|
| view_all | ✓ | ✓ | - |
| manage_units | ✓ | ✓ | - |
| manage_tenants | ✓ | ✓ | - |
| manage_leases | ✓ | ✓ | - |
| collect_rent | ✓ | ✓ | - |
| manage_work_orders | ✓ | ✓ | ✓ |
| view_work_orders | ✓ | ✓ | ✓ |
| manage_contractors | ✓ | ✓ | - |
| approve_payments | ✓ | - | - |
| view_finances | ✓ | ✓ | - |
| manage_equity | ✓ | - | - |
| view_audit | ✓ | - | - |

---

## Getting Started

### Prerequisites
- Node.js 20+ (use `node --version` to check)
- npm or pnpm
- Supabase project (create at https://supabase.com)

### Installation
```bash
cd /Users/andres/real-estate-management
npm install
```

### Environment Setup
Create `.env.local` with Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...xxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJ...xxxxx
ANTHROPIC_API_KEY=sk-ant-...
```

### Run Development Server
```bash
npm run dev
```
Open http://localhost:3000

### Deployment
```bash
npm run build
# Push to Vercel or any Node.js host
```

---

## Key Implementation Notes

### Authentication
- Use **Supabase Auth** (email/password + OAuth if needed)
- **getCurrentUser()** in `lib/auth-helpers.ts` returns `{ id, email, name, role }`
- **requirePermission()** checks role + permission before action
- Sessions persist via Supabase auth cookies

### Database Migrations
- All migrations are **idempotent** (safe to re-run)
- Run migrations via Supabase dashboard or `supabase db push`
- Use **CREATE OR REPLACE** pattern for functions
- Wrap policies in `DO` blocks to avoid conflicts

### AI Model Abstraction
- `lib/ai-client.ts` routes to any provider
- Models can be: `"claude-opus-4-7"`, `"gpt-4o"`, `"gemini-2.0-flash"`, etc.
- Fallback chain: Opus → Sonnet → Haiku → GPT-4o → Gemini
- Daily spend cap: `AI_DAILY_SPEND_CAP_USD` env var (default $20)

### HITL Workflow
- AI agent drafts → writes to `pending_approvals` table
- Dashboard shows approval queue
- Owner approves/rejects → status changes → auto-triggers action (email, update DB, etc.)
- Every approval logged to `audit_logs`

### UI / UX
- **Glassmorphism:** Semi-transparent cards with backdrop blur
- **Dark theme:** Tailwind's slate-950 background
- **Icons:** Emojis for quick visual scanning
- **No animations:** Except on hover (focus on clarity)
- **Mobile-first:** Grid layouts scale down gracefully

### Error Handling
- Server actions return `{ success: boolean, error?: string, data?: T }`
- No silent failures — all errors logged to `audit_logs`
- Cost overages fail-closed (no API calls, warn in logs)
- Network errors trigger fallback models

### Testing
- No unit tests yet (add as needed)
- Manual smoke tests: login → create unit → create tenant → add lease → mark rent paid

---

## Code Standards

### Do
- ✅ Use **server components** by default (faster, secure)
- ✅ Use **server actions** for mutations (cleaner than API routes)
- ✅ Return structured responses: `{ success, error, data }`
- ✅ Validate input at system boundary (don't trust client)
- ✅ Log meaningful events to `audit_logs`
- ✅ Use Tailwind classes for styling (no CSS files)
- ✅ Keep components simple + focused
- ✅ Use TypeScript (no `any` without justification)

### Don't
- ❌ Client-side data validation only (do it server-side)
- ❌ Hardcode API keys or secrets
- ❌ Use `require()` for ESM modules
- ❌ Add features beyond the current sprint
- ❌ Create new abstractions for code that appears 2x (wait for 3x)
- ❌ Add comments that describe what the code does (use descriptive names)
- ❌ Over-engineer for future use cases

---

## Roadmap

### Phase 1 (Current)
- ✅ Authentication (Supabase)
- ✅ Core CRUD (units, tenants, leases)
- ✅ Dashboard with KPIs
- 🔄 Rent collection + Stripe integration

### Phase 2
- Work orders + contractors
- P&L tracking + monthly reports
- Equity tracker + charts
- Contracts vault

### Phase 3
- AI agents (Otto, Ledger, Argus, Dispatch)
- HITL approval queue
- Notifications (Resend)
- Cron jobs (rent reminders, equity snapshots)

### Phase 4
- Mobile app (React Native)
- Integrations (Tastyworks for equity analysis, Twilio for SMS)
- Advanced reporting (tax prep, depreciation)

---

## Emergency Procedures

### Database Reset
```bash
# In Supabase dashboard: SQL Editor
DELETE FROM properties;  -- cascades to units, leases, etc.
```

### Auth Bypass (Development Only)
```bash
# Never in production!
export NEXT_PUBLIC_DEV_MODE=true
```

### Cost Control
- Monitor daily spend: Dashboard → API usage
- Set cap: `AI_DAILY_SPEND_CAP_USD=10` (default 20)
- Kill switch: `AI_KILL_SWITCH_OFF=false` (default)

---

## Contact & Support

**Owner:** Andres (frizzhasit@gmail.com)
**Property:** Trinity Home Builders LLC, 1304 Rosario St, Laredo TX 78040

For issues or clarifications, refer to:
1. This CLAUDE.md (source of truth)
2. Git commit history (why decisions were made)
3. Code comments (non-obvious logic only)
