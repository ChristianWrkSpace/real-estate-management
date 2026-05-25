# Real Estate Management OS — 1304 Rosario St, Laredo TX

AI-native property management system for your 4-unit residential property.

**Stack:** Next.js 16 + React 19 + Tailwind CSS + Supabase + **Any AI Model** (Claude, GPT, Gemini, DeepSeek, Groq, Mistral, custom) + Stripe + Resend

---

## ✨ Model-Agnostic AI (Unique Feature)

Use **any AI model** you want. Switch providers with a single environment variable. No code changes.

**Supported providers:**
- **Anthropic** (Claude Opus/Sonnet/Haiku) — Recommended, most capable
- **OpenAI** (GPT-4o, GPT-3.5)
- **Google** (Gemini 2.0, 1.5)
- **DeepSeek** (V3, R1) — Cheap, fast reasoning
- **Groq** (Mixtral, Llama 3.1) — Ultra-fast open-source
- **Mistral** (Large, Medium)
- **Custom** (self-hosted Ollama, LM Studio, etc.)

See [AI_PROVIDERS.md](AI_PROVIDERS.md) for full guide.

---

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and API keys to `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### 2. Create Database Migrations

In Supabase SQL Editor, run each file in order:
- `supabase/migrations/001_core.sql`
- `supabase/migrations/002_rent.sql`
- `supabase/migrations/003_work_orders.sql`
- `supabase/migrations/004_contracts.sql`
- `supabase/migrations/005_finances.sql`
- `supabase/migrations/006_equity.sql`
- `supabase/migrations/007_ai_infrastructure.sql`
- `supabase/migrations/008_rls.sql`

### 3. Configure AI Provider

Pick one or more providers:

**Claude (Recommended):**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**Or GPT-4:**
```bash
export OPENAI_API_KEY=sk-...
```

**Or DeepSeek (cheapest):**
```bash
export DEEPSEEK_API_KEY=sk-...
```

**Or all (fallback chain):**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export DEEPSEEK_API_KEY=sk-...
```

### 4. Start Locally

```bash
npm run dev
```

Visit **http://localhost:3000/login**

### 5. Create Account

Sign up with any email + password. First user becomes `owner`.

---

## Features (Current)

✅ **Auth** — Email/password with role-based access (owner, manager, maintenance)  
✅ **Dashboard** — KPI cards (occupancy, rent, work orders, equity)  
✅ **Units CRUD** — Manage 4 units (status: occupied/vacant/maintenance)  
✅ **Tenants Directory** — Tenant profiles with lease history  
✅ **Model-Agnostic AI** — Use any provider, switch instantly  

🚧 **Coming Soon:**
- Rent tracking + Stripe payment links
- Work order management
- Contractor directory
- Contracts vault (PDF storage)
- P&L dashboard
- Equity tracking
- AI agents (Otto, Ledger, Argus, Dispatch)
- HITL approval queue

---

## Model Usage Examples

**Use Claude by default:**
```typescript
import { aiClient } from "@/lib/ai-client";

const result = await aiClient.complete({
  model: "claude-opus-4-7",
  messages: [{ role: "user", content: "Draft a lease" }],
});
```

**Switch to GPT-4o:**
```typescript
const result = await aiClient.complete({
  model: "gpt-4o", // Just change this
  messages: [{ role: "user", content: "Draft a lease" }],
});
```

**Or use env variable:**
```bash
export DEFAULT_MODEL=deepseek-v3
```

**Or smart selection:**
```typescript
import { chooseModel } from "@/lib/ai-provider";

// Pick fastest model
const model = chooseModel({ speed: true });

// Pick cheapest model
const model = chooseModel({ cost: true });

// Pick best reasoning
const model = chooseModel({ reasoning: true });

// Pick under budget
const model = chooseModel({ 
  maxCostPerMTok: 0.002,  // Max $0.002 per 1M tokens
});
```

---

## Permissions

| Action | Owner | Manager | Maintenance |
|---|---|---|---|
| View all | ✓ | ✓ | - |
| Manage units | ✓ | ✓ | - |
| Manage tenants | ✓ | ✓ | - |
| Manage leases | ✓ | ✓ | - |
| Manage work orders | ✓ | ✓ | ✓ |
| Approve payments | ✓ | - | - |
| View finances | ✓ | ✓ | - |
| View audit logs | ✓ | - | - |

---

## Database Schema

**8 Idempotent Migrations:**

1. `properties`, `units`, `tenants`, `leases`
2. `rent_payments` (with Stripe hooks)
3. `contractors`, `work_orders`, `contractor_payments`
4. `contracts` (PDF vault)
5. `property_expenses` (categorized)
6. `equity_snapshots` (monthly)
7. AI infrastructure: `agent_invocations`, `agent_outcomes`, `pending_approvals`
8. RLS policies + helper functions

---

## Deployment

```bash
npm run build
vercel deploy --prod
```

Set environment variables in Vercel dashboard (same as `.env.local`).

---

## Philosophy

- **Dorsey:** Simple, focused, no bloat (7-click max)
- **Musk:** Fail-closed, unbreakable (RLS, auditing, cost caps)
- **Diamandis:** AI drives workflow, human approves what matters (HITL gates)

---

## Documentation

- **[AI_PROVIDERS.md](AI_PROVIDERS.md)** — Complete guide to all AI models and providers
- **[SETUP.md](SETUP.md)** — 5-minute quick start
- **[/plans/soft-mixing-otter.md](/Users/andres/.claude/plans/soft-mixing-otter.md)** — Full architecture

---

## Next Steps

1. Set up Supabase (2 min)
2. Run migrations (1 min)
3. Pick an AI provider (1 min)
4. `npm run dev` (30 sec)
5. Sign up and explore dashboard

Ready? Start with [SETUP.md](SETUP.md).
