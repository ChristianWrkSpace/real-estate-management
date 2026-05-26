# PropMan OS — Project Standards

Single source of truth for visual, structural, and backend conventions. Every PR must conform. When in doubt, copy the class strings from this file verbatim.

---

## 1. Visual System

### Background
Pure dark mode. Use `bg-[#09090b]` (zinc-950) on the dashboard shell. Never use lighter grays or off-blacks at the top level. The shell sits on `text-zinc-100`.

### The Standard Card
Every container at the dashboard level uses the same translucent card frame. Memorize this string:

```html
<div class="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-xl p-6 transition-all duration-300 hover:border-white/[0.15]">
```

Variants are allowed only via additional classes (e.g., a colored glow border on a highlighted card), never by replacing the base.

### Accent Glow Rings (Contextual)

Use sparingly, only on signal-bearing cards:

| Accent | Use case | Border / glow class |
|---|---|---|
| **Amber** | Tax intelligence, deadlines, warnings | `border-amber-400/30 shadow-[0_0_24px_rgba(245,158,11,0.12)]` |
| **Emerald** | Capital strategy, equity, success, money in | `border-emerald-400/30 shadow-[0_0_24px_rgba(16,185,129,0.12)]` |
| **Blue** | Yield / market data, neutral analytics | `border-blue-400/30 shadow-[0_0_24px_rgba(59,130,246,0.12)]` |
| **Rose** | Errors, delinquency, money out, eviction | `border-rose-400/30 shadow-[0_0_24px_rgba(244,63,94,0.12)]` |
| **Indigo** | Owner / God Mode / strategic | `border-indigo-400/30 shadow-[0_0_24px_rgba(99,102,241,0.12)]` |

### Buttons

**Primary action** (form submits, headline CTAs):

```html
<button class="rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/15 transition hover:from-emerald-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
```

**Secondary / utility** (re-run, refresh, sub-actions):

```html
<button class="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50">
```

**Destructive** (eviction, delete, force-X):

```html
<button class="rounded-lg bg-gradient-to-r from-rose-600 to-red-700 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition hover:from-rose-700 hover:to-red-800 disabled:opacity-50">
```

### Inputs

Every text input, select, and textarea uses the same focus ring:

```html
<input class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 transition focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-60">
```

---

## 2. Typography Hierarchy

| Role | Class string | Use |
|---|---|---|
| Page title (h1) | `text-3xl font-bold tracking-tight text-zinc-100` | Once per route |
| Section title (h2) | `text-xs font-bold uppercase tracking-[0.2em] text-zinc-400` | Section dividers |
| Card title | `text-zinc-100 font-semibold tracking-tight` | Card headers |
| Label / muted | `text-zinc-400 text-sm` | Stat labels, secondary info |
| Micro label | `text-[10px] font-semibold uppercase tracking-wider text-zinc-500` | Pill captions |
| Accent number | `text-emerald-400 font-mono` (or `text-rose-400`, `text-amber-400` per signal) | Numeric values, balances, deltas |
| Body | `text-sm leading-relaxed text-zinc-300` | Narrative paragraphs |

**Never** use `text-white` directly — always `text-zinc-100`. Never use `text-white/60` — always `text-zinc-400`. The zinc scale gives consistent contrast on `bg-[#09090b]`.

---

## 3. Grid System

### The Standard Grid

Use these grids verbatim. **Vertical stacking of full-width cards is forbidden** above the fold.

| Use case | Class string |
|---|---|
| Four-up KPI row | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6` |
| Two-up paired widget (e.g., Maintenance + Quick Actions) | `grid grid-cols-1 lg:grid-cols-2 gap-6` |
| Three-up narrative cards | `grid grid-cols-1 md:grid-cols-3 gap-6` |
| Per-unit grid (4-plex) | `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4` |

### Spacing

- Section gap: `space-y-8` between major sections inside a page
- Card internal padding: `p-6` for KPI cards, `p-4` for nested sub-cards, `p-8` for hero panels
- Inter-card gap: always `gap-6` (or `gap-4` for tighter nested grids)

### Dividers

**No raw horizontal `<hr>` or `border-t` lines across the screen.** Separate sections with whitespace (`space-y-8`) and section labels. Inside a card, you may use `border-t border-white/5` between rows.

---

## 4. Backend Integrity

Every server action (in `app/actions/*.ts`) must:

1. **Auth-gate** at the top — call `createServerSupabaseClient()` and verify `auth.uid()` belongs to a user with role `owner` or `manager` before mutating anything. Read-only fetchers may skip when RLS provides the gate.

2. **Atomic mutations.** When a single user-visible action touches multiple tables (e.g., onboarding accepts a lease + updates a tenant + flips a unit + creates a Stripe customer), order the writes so the primary signature/record commits first, and treat downstream side-effects as best-effort. If any downstream fails, surface a `success: true` with a warning in `error`, never a half-rolled-back state.

3. **Log to `ai_logs`.** Every mutating action — AI-driven or deterministic — writes one row with:
   - `agent_name`: namespaced identifier (e.g., `legal-notice`, `ledger-mortgage`, `argus-yield`)
   - `task_description`: short kebab/snake-case verb
   - `model_used`: model id if AI, `"deterministic"` otherwise
   - `token_cost`: USD (0 for deterministic)
   - `status`: `"succeeded"` or `"failed"`
   - `output_data`: full structured payload (the result the caller saw, plus enough context to audit)

4. **Return shape.** Always `{ success: boolean; error?: string; ...data }`. Never `throw` from a server action — catch and convert to the result shape so the client always renders cleanly.

5. **Revalidate.** After a successful mutation, call `revalidatePath()` for every route that depends on the mutated data (`/dashboard`, `/finance`, `/work-orders`, etc.).

---

## 5. Database Conventions

- All migrations are `IF NOT EXISTS` / `DROP POLICY IF EXISTS` + `CREATE POLICY`. Never raw `CREATE POLICY` — it rolls back the whole paste in Supabase SQL Editor when one duplicates.
- End every migration with `NOTIFY pgrst, 'reload schema';`.
- Apply via Supabase MCP `apply_migration` (preferred) or paste into the SQL Editor.
- Never depend on a migration tracked column existing without a prior probe via `scripts/probe-schema.ts`.

---

## 6. File Layout

- Server actions: `app/actions/<domain>.ts` (`"use server"` at top)
- AI agents: `lib/ai/agents/<agent>.ts` — must call `runFastAgent` / `runFrontierAgent` from the orchestrator, never the Anthropic SDK directly
- Client components: `components/<PascalCase>.tsx` — always `"use client"` at top when stateful
- Migrations: `supabase/migrations/NNN_snake_case.sql`
- Scripts: `scripts/<verb-noun>.ts` — must load `.env.local` via dotenv before any import that initializes a provider client

---

## 7. Code Standards

- Server components by default. Use `"use client"` only when you need state / browser APIs.
- Server actions for mutations. API routes only for external webhooks (Stripe, cron, third-party).
- No `any` without justification.
- No code comments unless the WHY is non-obvious (constraint, workaround, subtle invariant).
- No raw `console.log` in shipped code. Warnings go through `console.warn` and only for best-effort post-mutation work.
- No emojis in code (UI labels are fine when the user has asked for them).

---

When a new feature lands, the PR description must state which sections of this document apply and whether any exceptions were taken. Any drift from the standard requires a one-line justification.
