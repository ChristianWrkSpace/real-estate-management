# Model-Agnostic AI — Use Any Provider

Real Estate Management supports **every major AI model provider**. Switch models with a single line. No code changes needed.

## Supported Providers & Models

### Anthropic (Claude) — Recommended ⭐
**Most capable, best for complex reasoning**

```
claude-opus-4-7          $0.015/$0.06 per 1K tokens, 200K context
claude-sonnet-4-6        $0.003/$0.015 per 1K tokens, 200K context
claude-haiku-4-5         $0.0008/$0.004 per 1K tokens, 200K context
```

Setup:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### OpenAI (GPT)
**Strong general purpose, excellent for reasoning**

```
gpt-4o                   $0.005/$0.015 per 1K tokens, 128K context
gpt-4-turbo              $0.01/$0.03 per 1K tokens, 128K context
gpt-3.5-turbo            $0.0005/$0.0015 per 1K tokens, 16K context
```

Setup:
```bash
export OPENAI_API_KEY=sk-...
```

### Google (Gemini)
**Longest context window, very cheap**

```
gemini-2.0-flash         $0.000075/$0.0003 per 1K tokens, 1M context
gemini-1.5-pro           $0.00125/$0.005 per 1K tokens, 1M context
gemini-1.5-flash         $0.000075/$0.0003 per 1K tokens, 1M context
```

Setup:
```bash
export GOOGLE_API_KEY=...  # From google.ai
```

### DeepSeek
**Cheap reasoning, great value**

```
deepseek-v3              $0.000273/$0.00109 per 1K tokens, 64K context
deepseek-r1              $0.000546/$0.00219 per 1K tokens, 64K context
```

Setup:
```bash
export DEEPSEEK_API_KEY=sk-...
```

### Groq
**Ultra-fast open-source models via API**

```
mixtral-8x7b-32768       $0.00024/$0.00024 per 1K tokens, 32K context
llama-3.1-70b            $0.00059/$0.00079 per 1K tokens, 131K context
```

Setup:
```bash
export GROQ_API_KEY=gsk_...
```

### Mistral
**Fast, French-built, open-source focus**

```
mistral-large            $0.0024/$0.0072 per 1K tokens, 128K context
mistral-medium           $0.00027/$0.00081 per 1K tokens, 128K context
```

Setup:
```bash
export MISTRAL_API_KEY=...
```

---

## How to Use

### Option 1: Hard-code a Model

In your agent files (e.g., `lib/otto.ts`):

```typescript
import { aiClient } from "@/lib/ai-client";

const result = await aiClient.complete({
  model: "gpt-4o",  // Switch to any model here
  messages: [{ role: "user", content: "Draft a lease" }],
  _agent: "otto",
  _task: "draft_lease",
  maxTokens: 4096,
});
```

### Option 2: Use Environment Variable (Recommended)

Set a default model in `.env.local`:

```bash
DEFAULT_MODEL=claude-opus-4-7
```

Then in code:

```typescript
const model = process.env.DEFAULT_MODEL || "claude-opus-4-7";
const result = await aiClient.complete({
  model,
  messages: [...],
});
```

### Option 3: Smart Model Selection

Use the `chooseModel()` helper from `lib/ai-provider.ts`:

```typescript
import { chooseModel } from "@/lib/ai-provider";

// Use fastest model for this task
const fastModel = chooseModel({ speed: true });

// Use cheapest model
const cheapModel = chooseModel({ cost: true });

// Use best reasoning (Opus-class)
const smartModel = chooseModel({ reasoning: true });

// Use vision-capable model
const visionModel = chooseModel({ vision: true });

// Use specific provider
const gpteModel = chooseModel({ provider: "openai" });

// Use fastest model under $0.002 per 1M tokens
const budgetModel = chooseModel({ 
  speed: true,
  maxCostPerMTok: 0.002,
});

const result = await aiClient.complete({
  model: fastModel,
  messages: [...],
});
```

### Option 4: Per-Agent Configuration

Each AI agent can have its own preferred model:

```typescript
// lib/otto.ts (lease drafting — reasoning-heavy)
const model = chooseModel({ reasoning: true }); // → claude-opus-4-7

// lib/dispatch.ts (work order suggestions — speed-focused)
const model = chooseModel({ speed: true }); // → claude-haiku-4-5 or gpt-3.5

// lib/ledger.ts (P&L analysis — needs vision for expense photos)
const model = chooseModel({ vision: true, reasoning: true });
```

---

## Fallback Chains

If a model fails, the system automatically tries fallbacks. Pre-configured chains:

```
Claude Opus 4.7
  ↓ (fails)
Claude Sonnet 4.6
  ↓ (fails)
Gemini 2.0 Flash
  ↓ (fails)
GPT-4o
  ↓ (fails)
DeepSeek V3
```

Customize fallbacks in `lib/ai-provider.ts`:

```typescript
const fallbacks: Record<string, string[]> = {
  "gpt-4o": ["gpt-4-turbo", "claude-opus-4-7", "deepseek-v3"],
  // ... customize as needed
};
```

---

## Cost Comparison (per 1M tokens)

| Model | In + Out | Speed | Quality |
|---|---|---|---|
| Claude Opus | $21 | Slower | ⭐⭐⭐⭐⭐ |
| GPT-4o | $20 | Medium | ⭐⭐⭐⭐⭐ |
| Gemini 2.0 | $0.375 | Fast | ⭐⭐⭐⭐ |
| DeepSeek V3 | $3.82 | Fast | ⭐⭐⭐⭐ |
| Groq Mixtral | $0.48 | ⚡ (fastest) | ⭐⭐⭐ |
| Claude Haiku | $4 | Fast | ⭐⭐⭐ |

**Recommendation:**
- **Production:** Claude Opus 4.7 (best reasoning)
- **Fallback:** Gemini 2.0 Flash (cheap, fast, good)
- **Cost optimization:** DeepSeek V3 (70% cheaper than Claude)
- **Ultra-fast:** Groq Mixtral (sub-100ms)

---

## Rate Limiting & Cost Caps

The system enforces:

```typescript
// Daily spend cap (prevent surprises)
AI_DAILY_SPEND_CAP_USD=20

// Kill-switch override (if needed)
AI_KILL_SWITCH_OFF=true

// Per-call timeout
_timeout_ms: 60000  // Default: 60 seconds
```

All invocations are logged to `agent_invocations` table for audit trail.

---

## Example: Switch Models at Runtime

```typescript
// endpoints/completions.ts
export async function POST(req: Request) {
  const { userPreferredModel, messages } = await req.json();

  // Use user preference, or fall back to default
  const model = userPreferredModel || process.env.DEFAULT_MODEL || "claude-opus-4-7";

  const result = await aiClient.complete({
    model,
    messages,
    _agent: "user_request",
    _task: "custom_completion",
  });

  return Response.json(result);
}
```

---

## Adding a New Provider

To add support for a new provider (e.g., Anthropic's competitor X):

1. Add to `MODEL_REGISTRY` in `lib/ai-provider.ts`:
```typescript
"model-x-large": {
  id: "model-x-large",
  provider: "model-x",
  displayName: "Model X Large",
  costPer1kInputTokens: 0.01,
  costPer1kOutputTokens: 0.03,
  contextWindow: 128000,
  supportsFunctions: true,
  supportsVision: true,
},
```

2. Add provider type:
```typescript
export type ModelProvider = "anthropic" | "openai" | "google" | "deepseek" | "groq" | "mistral" | "model-x";
```

3. Implement in `lib/ai-client.ts`:
```typescript
case "model-x":
  return await this.completeWithModelX(params);
```

4. Add environment variable:
```bash
MODEL_X_API_KEY=...
```

---

## Best Practices

✅ **DO:**
- Use Opus/GPT-4 for legal/financial work (leases, P&L, eviction notices)
- Use Haiku/3.5-turbo for fast tasks (work order drafting, suggestions)
- Use Gemini/DeepSeek for long documents (equity reports, contract reviews)
- Monitor daily spend against cap
- Log all AI invocations for audit

❌ **DON'T:**
- Hard-code API keys in code (use .env.local)
- Assume fallback chains work without testing
- Skip cost calculations
- Use free tier models in production

---

## Troubleshooting

**"Unknown model: gpt-4o"**
→ Ensure `OPENAI_API_KEY` is set in `.env.local`

**"Daily AI spend cap exceeded"**
→ Increase `AI_DAILY_SPEND_CAP_USD` or set `AI_KILL_SWITCH_OFF=true`

**Model fallback isn't working**
→ Check `lib/ai-provider.ts` getFallbackChain() for your model

**All providers failing**
→ Fall back to running locally with Ollama or similar
