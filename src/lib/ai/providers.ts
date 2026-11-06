/**
 * AI services the assistant can use. Claude goes through Anthropic's own
 * SDK; the others speak the widely shared OpenAI-style chat API, so adding
 * one is a base address and a key name. Keys live in Vercel as environment
 * variables, never in the database or the code.
 *
 * Model names change often, so only Claude's are listed here; for the rest
 * the developer page loads the service's current list with the key.
 */

export type ProviderKind = "anthropic" | "openai";

export interface Provider {
  id: string;
  name: string;
  /** Who makes it, or what it gives access to. */
  maker: string;
  kind: ProviderKind;
  /** Environment variables checked for the key, in order. */
  keys: string[];
  /** For OpenAI-style services; can be changed on the developer page. */
  baseUrl?: string;
  /** A starting model, where we know one to be current. */
  defaultModel?: string;
  models?: string[];
  /** Where to make a key. */
  console: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    name: "Claude",
    maker: "Anthropic",
    kind: "anthropic",
    keys: ["ANTHROPIC_API_KEY"],
    defaultModel: "claude-opus-5-5",
    models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    console: "console.anthropic.com",
  },
  {
    id: "openai",
    name: "ChatGPT",
    maker: "OpenAI",
    kind: "openai",
    keys: ["OPENAI_API_KEY"],
    baseUrl: "https://api.openai.com/v1",
    console: "platform.openai.com",
  },
  {
    id: "gemini",
    name: "Gemini",
    maker: "Google",
    kind: "openai",
    keys: ["GEMINI_API_KEY"],
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    console: "aistudio.google.com",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    maker: "DeepSeek",
    kind: "openai",
    keys: ["DEEPSEEK_API_KEY"],
    baseUrl: "https://api.deepseek.com/v1",
    console: "platform.deepseek.com",
  },
  {
    id: "qwen",
    name: "Qwen",
    maker: "Alibaba Cloud Model Studio",
    kind: "openai",
    keys: ["QWEN_API_KEY", "DASHSCOPE_API_KEY"],
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    console: "modelstudio.console.alibabacloud.com",
  },
  {
    id: "mistral",
    name: "Mistral",
    maker: "Mistral AI",
    kind: "openai",
    keys: ["MISTRAL_API_KEY"],
    baseUrl: "https://api.mistral.ai/v1",
    console: "console.mistral.ai",
  },
  {
    id: "xai",
    name: "Grok",
    maker: "xAI",
    kind: "openai",
    keys: ["XAI_API_KEY"],
    baseUrl: "https://api.x.ai/v1",
    console: "console.x.ai",
  },
  {
    id: "moonshot",
    name: "Kimi",
    maker: "Moonshot AI",
    kind: "openai",
    keys: ["MOONSHOT_API_KEY"],
    baseUrl: "https://api.moonshot.ai/v1",
    console: "platform.moonshot.ai",
  },
  {
    id: "groq",
    name: "Groq",
    maker: "Llama, Qwen and others, served fast",
    kind: "openai",
    keys: ["GROQ_API_KEY"],
    baseUrl: "https://api.groq.com/openai/v1",
    console: "console.groq.com",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    maker: "Hundreds of models with one key",
    kind: "openai",
    keys: ["OPENROUTER_API_KEY"],
    baseUrl: "https://openrouter.ai/api/v1",
    console: "openrouter.ai",
  },
  {
    id: "vercel",
    name: "Vercel AI Gateway",
    maker: "Many makers with one key and one bill",
    kind: "openai",
    keys: ["AI_GATEWAY_API_KEY"],
    baseUrl: "https://ai-gateway.vercel.sh/v1",
    console: "vercel.com/ai-gateway",
  },
  {
    id: "custom",
    name: "Other",
    maker: "Any OpenAI-style service: enter its address",
    kind: "openai",
    keys: ["AI_CUSTOM_API_KEY"],
    baseUrl: "",
    console: "",
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** The provider's key from the environment, if set. Never sent to the browser. */
export function providerKey(p: Provider): string | null {
  for (const name of p.keys) {
    const v = process.env[name];
    if (v) return v;
  }
  return null;
}
