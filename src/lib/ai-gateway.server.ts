// Server-only: AI providers for the AI SDK.
// Never import this file from client code.
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

/**
 * Direct Google Gemini provider (native Gemini API).
 * Used on external deployments (e.g. Vercel) where LOVABLE_API_KEY
 * is not available : the app owner sets GEMINI_API_KEY instead.
 * The native provider (not the OpenAI-compatible endpoint) is required for
 * Gemini 3+ tool calling, which must send thought signatures back.
 */
export function createGeminiProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}
