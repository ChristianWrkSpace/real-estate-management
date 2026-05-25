# PropMan OS — Quick Start Guide

Your property management OS is ready to go. Here's how to get it running in 5 minutes.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free tier is fine)
2. Create a new project
3. Copy your credentials to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find these in: Supabase Dashboard → Settings → API

## Step 2: Run Database Migrations

Go to Supabase SQL Editor and copy-paste each file:

1. `supabase/migrations/001_core.sql`
2. `supabase/migrations/002_rent.sql`
3. `supabase/migrations/003_work_orders.sql`
4. `supabase/migrations/004_contracts.sql`
5. `supabase/migrations/005_finances.sql`
6. `supabase/migrations/006_equity.sql`
7. `supabase/migrations/007_ai_infrastructure.sql`
8. `supabase/migrations/008_rls.sql`

Run each one. If you get "already exists" errors, that's fine — the migrations are idempotent.

## Step 3: Start the App

```bash
npm run dev
```

Open **http://localhost:3000/login**

## Step 4: Create Your First Account

Sign up with any email + password. You'll automatically become the `owner` role.

## That's It!

You now have:
- ✅ Auth (email/password)
- ✅ Dashboard with KPIs (occupancy, rent collected, work orders, equity)
- ✅ Units (view your 4 units)
- ✅ Tenants (directory)
- ✅ Sidebar navigation

## Next: Add Your Property

Once logged in, go to **Dashboard** and you'll see placeholders for:
- Occupancy rate
- Rent collected
- Open work orders
- Current equity

These will populate once we add your property details to the database.

## Optional: Configure Stripe & Anthropic

To enable rent collection and AI features, add to `.env.local`:

```bash
# Stripe (for rent payment links)
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

# Anthropic (for AI agents)
ANTHROPIC_API_KEY=sk-ant-...

# Resend (for email)
RESEND_API_KEY=re_...
```

## Full Feature List (Roadmap)

| Feature | Status |
|---|---|
| Auth | ✅ Done |
| Dashboard | ✅ Done |
| Units CRUD | ✅ Done |
| Tenants CRUD | ✅ Done |
| Rent tracking | 🚧 Coming |
| Work orders | 🚧 Coming |
| Contractors | 🚧 Coming |
| Contracts vault | 🚧 Coming |
| P&L dashboard | 🚧 Coming |
| Equity tracker | 🚧 Coming |
| AI agents (Otto, Ledger, Argus, Dispatch) | 🚧 Coming |
| HITL approval queue | 🚧 Coming |

## Troubleshooting

**"Module not found: @/lib/..."**
→ Make sure you ran `npm install`

**"Cannot find Supabase project"**
→ Check your `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL`

**"First user not becoming owner"**
→ Check the profiles table in Supabase — first user should have `role='owner'`

## Support

Check `README.md` for architecture details.

Everything is built on Jack Dorsey simplicity (no bloat), Elon brute-force reliability (fail-closed), and Diamandis moonshot thinking (AI drives workflow, human approves what matters).
