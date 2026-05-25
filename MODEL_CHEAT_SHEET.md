# Model Selection Cheat Sheet

Quick reference for choosing the right model for your task.

## By Task

| Task | Recommended Model | Why | Cost |
|---|---|---|---|
| **Lease drafting** | Claude Opus 4.7 | Best reasoning, legal accuracy | $21/1M |
| **P&L analysis** | Claude Opus 4.7 or GPT-4o | Complex data interpretation | $20-21/1M |
| **Property description** | Gemini 2.0 Flash | Long context, very cheap | $0.375/1M |
| **Work order suggestions** | Claude Haiku or GPT-3.5 | Speed over quality | $4/1M |
| **Tenant communication** | Claude Sonnet 4.6 | Good quality, reasonable cost | $4.5/1M |
| **Photo assessment** | Claude Opus 4.7 | Vision capability + reasoning | $21/1M |
| **Quick brainstorm** | Groq Mixtral | Ultra-fast | $0.48/1M |
| **Budget analysis** | DeepSeek V3 | Great reasoning at 70% discount | $3.82/1M |
| **Multi-document review** | Gemini 1.5 Pro | 1M token context | $6.25/1M |

## By Criteria

**Cheapest:**
```typescript
chooseModel({ cost: true })
// → DeepSeek V3 ($3.82/1M) or Gemini 2.0 Flash ($0.375/1M)
```

**Fastest:**
```typescript
chooseModel({ speed: true })
// → Claude Haiku (~200ms) or Groq Mixtral (~100ms)
```

**Best Reasoning:**
```typescript
chooseModel({ reasoning: true })
// → Claude Opus 4.7 or GPT-4o
```

**Vision Capable:**
```typescript
chooseModel({ vision: true })
// → Claude Opus/Sonnet/Haiku, GPT-4o, Gemini models, DeepSeek V3
```

**Budget (under $2/1M tokens):**
```typescript
chooseModel({ maxCostPerMTok: 0.002 })
// → Gemini 2.0 Flash ($0.375/1M), Groq ($0.48/1M), DeepSeek R1 ($1.77/1M)
```

## Budget Tiers

**Luxury ($20+/1M tokens):**
- Claude Opus 4.7
- GPT-4o

**Standard ($3-6/1M tokens):**
- Claude Sonnet 4.6
- DeepSeek V3

**Budget ($0.40-1/1M tokens):**
- Gemini 2.0 Flash
- Claude Haiku
- Groq Mixtral
- DeepSeek R1

## Provider Comparison

| Provider | Best For | Cheapest | Fastest | Most Capable |
|---|---|---|---|---|
| **Anthropic** | Reasoning | Haiku ($4/1M) | Haiku | Opus |
| **OpenAI** | General purpose | 3.5 ($2/1M) | 3.5 | GPT-4o |
| **Google** | Long docs | Gemini Flash ($0.375/1M) | Flash | 1.5 Pro |
| **DeepSeek** | Budget + reasoning | R1 ($1.77/1M) | V3 | R1 |
| **Groq** | Speed | Mixtral ($0.48/1M) | Mixtral | Mixtral |
| **Mistral** | Balanced | Medium ($1.08/1M) | Medium | Large |

## Setting Default Model

### Option 1: Environment Variable
```bash
# In .env.local
DEFAULT_MODEL=claude-opus-4-7
```

### Option 2: Per-Agent
```typescript
// lib/otto.ts (lease AI)
const model = "claude-opus-4-7";

// lib/dispatch.ts (fast suggestions)
const model = "claude-haiku-4-5";
```

### Option 3: Runtime Selection
```typescript
import { chooseModel } from "@/lib/ai-provider";

const model = chooseModel({
  reasoning: true,           // Want best thinking
  maxCostPerMTok: 0.005,     // But max $5/1M
});
// → Returns Claude Sonnet 4.6 ($4.5/1M)
```

## Switching Models

**No code changes needed:**

```bash
# Current setup
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev

# Next week, switch to GPT
export OPENAI_API_KEY=sk-...
unset ANTHROPIC_API_KEY
npm run dev
# → All agents now use gpt-4o
```

## Estimating Monthly Cost

```typescript
import { MODEL_REGISTRY, calculateCost } from "@/lib/ai-provider";

// Example: Lease drafting
const model = MODEL_REGISTRY["claude-opus-4-7"];
const tokensPerLease = 3000;  // 3K in, 2K out
const costPerLease = calculateCost("claude-opus-4-7", 3000, 2000);
// → $0.135 per lease

// 50 leases/month
const monthlyCost = costPerLease * 50;
// → $6.75/month for lease drafting
```

## Fallback Chain (If Primary Fails)

Default chain:
```
Claude Opus 4.7
  ↓
Claude Sonnet 4.6
  ↓
Gemini 2.0 Flash
  ↓
GPT-4o
  ↓
DeepSeek V3
```

Each step tries if previous times out or returns error.

## Emergency Quick-Switch

If primary provider goes down:

```bash
# Switch ALL agents to backup provider
export ANTHROPIC_API_KEY=
export OPENAI_API_KEY=sk-...
# OR
export DEEPSEEK_API_KEY=sk-...
```

System will route to next available provider automatically via fallback chains.

---

**Need more details?** See [AI_PROVIDERS.md](AI_PROVIDERS.md)
