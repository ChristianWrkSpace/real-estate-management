/**
 * Unified AI client that routes to any provider (Anthropic, OpenAI, Google, DeepSeek, Groq, etc.)
 *
 * Usage:
 *   const result = await aiClient.complete({
 *     model: "claude-opus-4-7", // or "gpt-4o", "gemini-2.0-flash", etc.
 *     messages: [{ role: "user", content: "Hello" }],
 *     _agent: "otto",
 *     _task: "draft_lease",
 *   });
 */

import { Anthropic } from "@anthropic-ai/sdk";
import {
  AICompletionParams,
  AICompletionResult,
  calculateCost,
  getModel,
  getFallbackChain,
} from "./ai-provider";

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// Other provider SDKs (openai, @google/generative-ai, etc.) are loaded
// lazily inside their per-provider methods so the bundle doesn't fail to
// resolve modules that haven't been installed yet.

export class AIClient {
  private costCap: number = 50; // USD per day
  private dailySpent: number = 0;
  private killSwitchOff: boolean = false;

  constructor() {
    this.costCap = parseFloat(process.env.AI_DAILY_SPEND_CAP_USD || "50");
    this.killSwitchOff = process.env.AI_KILL_SWITCH_OFF === "true";
  }

  /**
   * Main completion method - routes to appropriate provider.
   * Tracks visited models in a Set to prevent the fallback chain from
   * looping (e.g. mistral → mixtral → llama → mistral).
   */
  async complete(
    params: AICompletionParams,
    visited: Set<string> = new Set()
  ): Promise<AICompletionResult> {
    const model = getModel(params.model);
    if (!model) {
      throw new Error(`Unknown model: ${params.model}`);
    }

    visited.add(params.model);

    // Check cost cap (unless overridden)
    if (!this.killSwitchOff && this.dailySpent >= this.costCap) {
      console.warn(`Daily AI spend cap ($${this.costCap}) reached`);
      throw new Error("Daily AI spend cap exceeded");
    }

    try {
      // Route to appropriate provider
      switch (model.provider) {
        case "anthropic":
          return await this.completeWithAnthropic(params);
        case "openai":
          return await this.completeWithOpenAI(params);
        case "google":
          return await this.completeWithGoogle(params);
        case "deepseek":
          return await this.completeWithDeepSeek(params);
        case "groq":
          return await this.completeWithGroq(params);
        case "mistral":
          return await this.completeWithMistral(params);
        default:
          // Fallback to Claude
          return await this.completeWithAnthropic(params);
      }
    } catch (error) {
      // Try fallback models — skip any we've already tried and any whose
      // provider has no API key set, to avoid pointless retries.
      const next = getFallbackChain(params.model).find(
        (m) => !visited.has(m) && this.providerKeyAvailable(getModel(m)?.provider)
      );
      if (next) {
        console.warn(`Model ${params.model} failed, trying fallback: ${next}`);
        return this.complete({ ...params, model: next }, visited);
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  private providerKeyAvailable(provider: string | undefined): boolean {
    switch (provider) {
      case "anthropic": return !!process.env.ANTHROPIC_API_KEY;
      case "openai":    return !!process.env.OPENAI_API_KEY;
      case "google":    return !!process.env.GOOGLE_API_KEY;
      case "deepseek":  return !!process.env.DEEPSEEK_API_KEY;
      case "groq":      return !!process.env.GROQ_API_KEY;
      case "mistral":   return !!process.env.MISTRAL_API_KEY;
      default:          return false;
    }
  }

  /**
   * Anthropic (Claude) completion
   */
  private async completeWithAnthropic(
    params: AICompletionParams
  ): Promise<AICompletionResult> {
    const messages = params.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content
            : m.content.text,
    }));

    const createParams: any = {
      model: params.model,
      max_tokens: params.maxTokens || 4096,
      messages,
    };

    if (params.systemPrompt) {
      createParams.system = params.systemPrompt;
    }

    if (params.temperature !== undefined) {
      createParams.temperature = params.temperature;
    }

    const response = await getAnthropic().messages.create(createParams);

    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const cost = calculateCost(params.model, tokensIn, tokensOut);

    this.dailySpent += cost;

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    return {
      content,
      tokensIn,
      tokensOut,
      costUsd: cost,
      model: params.model,
      provider: "anthropic",
    };
  }

  /**
   * OpenAI (GPT) completion - placeholder
   */
  private async completeWithOpenAI(
    params: AICompletionParams
  ): Promise<AICompletionResult> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not set");
    }

    // This is a placeholder - in production, you'd use the OpenAI SDK
    // const { OpenAI } = require("openai");
    // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // const response = await openai.chat.completions.create({...});

    throw new Error("OpenAI provider not yet implemented. Set ANTHROPIC_API_KEY to use Claude instead.");
  }

  /**
   * Google Gemini completion - placeholder
   */
  private async completeWithGoogle(
    params: AICompletionParams
  ): Promise<AICompletionResult> {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY not set");
    }

    throw new Error("Google Gemini provider not yet implemented. Set ANTHROPIC_API_KEY to use Claude instead.");
  }

  /**
   * DeepSeek completion - placeholder
   */
  private async completeWithDeepSeek(
    params: AICompletionParams
  ): Promise<AICompletionResult> {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY not set");
    }

    throw new Error("DeepSeek provider not yet implemented. Set ANTHROPIC_API_KEY to use Claude instead.");
  }

  /**
   * Groq completion - placeholder
   */
  private async completeWithGroq(
    params: AICompletionParams
  ): Promise<AICompletionResult> {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not set");
    }

    throw new Error("Groq provider not yet implemented. Set ANTHROPIC_API_KEY to use Claude instead.");
  }

  /**
   * Mistral completion - placeholder
   */
  private async completeWithMistral(
    params: AICompletionParams
  ): Promise<AICompletionResult> {
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY not set");
    }

    throw new Error("Mistral provider not yet implemented. Set ANTHROPIC_API_KEY to use Claude instead.");
  }
}

// Export singleton instance
export const aiClient = new AIClient();
