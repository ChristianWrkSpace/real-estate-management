/**
 * Model-agnostic AI provider abstraction.
 * Supports: Claude (Anthropic), GPT (OpenAI), Gemini (Google), DeepSeek, open-source, etc.
 */

export type ModelProvider = "anthropic" | "openai" | "google" | "deepseek" | "groq" | "mistral" | "custom";

export interface AIModel {
  id: string;
  provider: ModelProvider;
  displayName: string;
  costPer1kInputTokens: number; // USD
  costPer1kOutputTokens: number; // USD
  contextWindow: number;
  supportsFunctions: boolean;
  supportsVision: boolean;
}

export interface MessageParam {
  role: "user" | "assistant" | "system";
  content: string | { type: "text"; text: string } | { type: "image"; image: string }[];
}

export interface AICompletionParams {
  model: string; // Model ID from MODEL_REGISTRY
  messages: MessageParam[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  _agent?: string;
  _task?: string;
  _timeout_ms?: number;
  _max_retries?: number;
  [key: string]: unknown;
}

export interface AICompletionResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  model: string;
  provider: ModelProvider;
}

// Comprehensive model registry (supports all major providers)
export const MODEL_REGISTRY: Record<string, AIModel> = {
  // Anthropic Claude models
  "claude-opus-4-7": {
    id: "claude-opus-4-7",
    provider: "anthropic",
    displayName: "Claude Opus 4.7",
    costPer1kInputTokens: 0.015,
    costPer1kOutputTokens: 0.06,
    contextWindow: 200000,
    supportsFunctions: true,
    supportsVision: true,
  },
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    displayName: "Claude Sonnet 4.6",
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.015,
    contextWindow: 200000,
    supportsFunctions: true,
    supportsVision: true,
  },
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    displayName: "Claude Haiku 4.5",
    costPer1kInputTokens: 0.0008,
    costPer1kOutputTokens: 0.004,
    contextWindow: 200000,
    supportsFunctions: true,
    supportsVision: true,
  },

  // OpenAI models
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    displayName: "GPT-4o",
    costPer1kInputTokens: 0.005,
    costPer1kOutputTokens: 0.015,
    contextWindow: 128000,
    supportsFunctions: true,
    supportsVision: true,
  },
  "gpt-4-turbo": {
    id: "gpt-4-turbo",
    provider: "openai",
    displayName: "GPT-4 Turbo",
    costPer1kInputTokens: 0.01,
    costPer1kOutputTokens: 0.03,
    contextWindow: 128000,
    supportsFunctions: true,
    supportsVision: true,
  },
  "gpt-3.5-turbo": {
    id: "gpt-3.5-turbo",
    provider: "openai",
    displayName: "GPT-3.5 Turbo",
    costPer1kInputTokens: 0.0005,
    costPer1kOutputTokens: 0.0015,
    contextWindow: 16384,
    supportsFunctions: true,
    supportsVision: false,
  },

  // Google Gemini models
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    provider: "google",
    displayName: "Gemini 2.0 Flash",
    costPer1kInputTokens: 0.000075,
    costPer1kOutputTokens: 0.0003,
    contextWindow: 1000000,
    supportsFunctions: true,
    supportsVision: true,
  },
  "gemini-1.5-pro": {
    id: "gemini-1.5-pro",
    provider: "google",
    displayName: "Gemini 1.5 Pro",
    costPer1kInputTokens: 0.00125,
    costPer1kOutputTokens: 0.005,
    contextWindow: 1000000,
    supportsFunctions: true,
    supportsVision: true,
  },
  "gemini-1.5-flash": {
    id: "gemini-1.5-flash",
    provider: "google",
    displayName: "Gemini 1.5 Flash",
    costPer1kInputTokens: 0.000075,
    costPer1kOutputTokens: 0.0003,
    contextWindow: 1000000,
    supportsFunctions: true,
    supportsVision: true,
  },

  // DeepSeek models
  "deepseek-v3": {
    id: "deepseek-v3",
    provider: "deepseek",
    displayName: "DeepSeek V3",
    costPer1kInputTokens: 0.000273,
    costPer1kOutputTokens: 0.00109,
    contextWindow: 64000,
    supportsFunctions: true,
    supportsVision: true,
  },
  "deepseek-r1": {
    id: "deepseek-r1",
    provider: "deepseek",
    displayName: "DeepSeek R1",
    costPer1kInputTokens: 0.000546,
    costPer1kOutputTokens: 0.00219,
    contextWindow: 64000,
    supportsFunctions: true,
    supportsVision: false,
  },

  // Groq (fast open-source models via API)
  "mixtral-8x7b-32768": {
    id: "mixtral-8x7b-32768",
    provider: "groq",
    displayName: "Mixtral 8x7B",
    costPer1kInputTokens: 0.00024,
    costPer1kOutputTokens: 0.00024,
    contextWindow: 32768,
    supportsFunctions: true,
    supportsVision: false,
  },
  "llama-3.1-70b": {
    id: "llama-3.1-70b",
    provider: "groq",
    displayName: "Llama 3.1 70B",
    costPer1kInputTokens: 0.00059,
    costPer1kOutputTokens: 0.00079,
    contextWindow: 131072,
    supportsFunctions: true,
    supportsVision: false,
  },

  // Mistral models
  "mistral-large": {
    id: "mistral-large",
    provider: "mistral",
    displayName: "Mistral Large",
    costPer1kInputTokens: 0.0024,
    costPer1kOutputTokens: 0.0072,
    contextWindow: 128000,
    supportsFunctions: true,
    supportsVision: true,
  },
  "mistral-medium": {
    id: "mistral-medium",
    provider: "mistral",
    displayName: "Mistral Medium",
    costPer1kInputTokens: 0.00027,
    costPer1kOutputTokens: 0.00081,
    contextWindow: 128000,
    supportsFunctions: true,
    supportsVision: false,
  },
};

/**
 * Get a model from the registry by ID
 */
export function getModel(modelId: string): AIModel | null {
  return MODEL_REGISTRY[modelId] || null;
}

/**
 * Get all models for a specific provider
 */
export function getModelsByProvider(provider: ModelProvider): AIModel[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.provider === provider);
}

/**
 * Calculate cost for a completion
 */
export function calculateCost(
  modelId: string,
  tokensIn: number,
  tokensOut: number
): number {
  const model = getModel(modelId);
  if (!model) return 0;

  const inputCost = (tokensIn / 1000) * model.costPer1kInputTokens;
  const outputCost = (tokensOut / 1000) * model.costPer1kOutputTokens;

  return inputCost + outputCost;
}

/**
 * Get recommended fallback chain for a model
 * (e.g., if Opus fails, try Sonnet, then Haiku, then fallback to another provider)
 */
export function getFallbackChain(modelId: string): string[] {
  // Define smart fallback paths
  const fallbacks: Record<string, string[]> = {
    // Claude fallbacks
    "claude-opus-4-7": ["claude-sonnet-4-6", "gemini-2.0-flash", "gpt-4o", "deepseek-v3"],
    "claude-sonnet-4-6": ["claude-haiku-4-5", "gpt-3.5-turbo", "mistral-medium"],
    "claude-haiku-4-5": ["gpt-3.5-turbo", "mistral-medium", "llama-3.1-70b"],

    // GPT fallbacks
    "gpt-4o": ["gpt-4-turbo", "gemini-1.5-pro", "claude-opus-4-7"],
    "gpt-4-turbo": ["gpt-3.5-turbo", "claude-sonnet-4-6"],
    "gpt-3.5-turbo": ["mistral-medium", "claude-haiku-4-5"],

    // Gemini fallbacks
    "gemini-2.0-flash": ["gemini-1.5-pro", "gpt-4o", "claude-opus-4-7"],
    "gemini-1.5-pro": ["gemini-1.5-flash", "claude-opus-4-7"],
    "gemini-1.5-flash": ["mistral-medium", "gpt-3.5-turbo"],

    // DeepSeek fallbacks
    "deepseek-v3": ["deepseek-r1", "mistral-large", "gpt-4o"],
    "deepseek-r1": ["mistral-large", "llama-3.1-70b"],

    // Groq fallbacks (fast but limited)
    "mixtral-8x7b-32768": ["llama-3.1-70b", "mistral-medium"],
    "llama-3.1-70b": ["mistral-medium", "deepseek-v3"],

    // Mistral fallbacks
    "mistral-large": ["mistral-medium", "deepseek-v3", "gpt-4o"],
    "mistral-medium": ["mixtral-8x7b-32768", "gpt-3.5-turbo"],
  };

  return fallbacks[modelId] || [];
}

/**
 * Choose a model based on criteria (speed, cost, reasoning, vision, etc.)
 */
export function chooseModel(criteria: {
  speed?: boolean; // Prefer fastest
  cost?: boolean; // Prefer cheapest
  reasoning?: boolean; // Prefer best reasoning
  vision?: boolean; // Requires vision capability
  provider?: ModelProvider; // Prefer specific provider
  maxCostPerMTok?: number; // Max cost per 1M tokens
}): string {
  let candidates = Object.values(MODEL_REGISTRY);

  // Filter by criteria
  if (criteria.vision) {
    candidates = candidates.filter((m) => m.supportsVision);
  }

  if (criteria.provider) {
    candidates = candidates.filter((m) => m.provider === criteria.provider);
  }

  if (criteria.maxCostPerMTok) {
    const maxCostPer1k = criteria.maxCostPerMTok / 1000;
    candidates = candidates.filter(
      (m) => m.costPer1kInputTokens <= maxCostPer1k
    );
  }

  // Sort by preference
  if (criteria.speed) {
    // Prefer smaller context = typically faster
    candidates.sort((a, b) => a.contextWindow - b.contextWindow);
  } else if (criteria.cost) {
    // Prefer cheaper
    candidates.sort(
      (a, b) =>
        a.costPer1kInputTokens +
        a.costPer1kOutputTokens -
        (b.costPer1kInputTokens + b.costPer1kOutputTokens)
    );
  } else if (criteria.reasoning) {
    // Prefer larger models (usually better reasoning)
    candidates.sort((a, b) => b.contextWindow - a.contextWindow);
  }

  return candidates[0]?.id || "claude-haiku-4-5"; // Safe fallback
}
