/**
 * AI provider configuration — the ONLY place that reads provider env vars.
 * Every supported provider speaks the OpenAI-compatible /chat/completions protocol,
 * so switching providers is purely a matter of environment variables.
 */
import type { ClientSettings } from "./types";

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  needsKey: boolean;
  free: string;
}

export const PRESETS: Record<string, ProviderPreset> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    needsKey: true,
    free: "Free models available (IDs ending in :free)",
  },
  groq: {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    needsKey: true,
    free: "Free tier with rate limits",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    needsKey: true,
    free: "Free tier via Google AI Studio",
  },
  together: {
    id: "together",
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    needsKey: true,
    free: "Free model tier",
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5-coder:7b",
    needsKey: false,
    free: "Fully local & free — open-source models on your machine",
  },
  custom: {
    id: "custom",
    label: "Custom OpenAI-compatible",
    baseUrl: "",
    defaultModel: "",
    needsKey: false,
    free: "Any OpenAI-compatible endpoint (vLLM, LM Studio, LiteLLM…)",
  },
};

/** Providers a browser user may pick from Settings. `ollama`/`custom` are env-only (SSRF safety). */
export const CLIENT_SELECTABLE = ["openrouter", "groq", "gemini", "together"];

export interface ProviderConfig {
  id: string;
  label: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  jsonMode: "on" | "off" | "auto";
  timeoutMs: number;
  temperature: number;
  headers: Record<string, string>;
  source: "env" | "client";
}

const env = (k: string) => (process.env[k] ?? "").trim();

export function resolveProvider(client?: ClientSettings): ProviderConfig | null {
  const allowClient = env("ALLOW_CLIENT_KEYS") !== "false";
  const useClient = allowClient && !!client?.apiKey && !!client.provider && CLIENT_SELECTABLE.includes(client.provider);

  const id = useClient ? client!.provider! : (env("AI_PROVIDER") || "openrouter").toLowerCase();
  const preset = PRESETS[id] ?? PRESETS.custom;
  const apiKey = useClient ? client!.apiKey : env("AI_API_KEY") || undefined;
  const baseUrl = useClient ? preset.baseUrl : env("AI_BASE_URL") || preset.baseUrl;
  const model = (useClient ? client!.model : "") || (!useClient && env("AI_MODEL")) || preset.defaultModel;

  if (!baseUrl || !model) return null;
  if (preset.needsKey && !apiKey) return null;
  if (id === "custom" && !env("AI_BASE_URL")) return null;

  const json = env("AI_JSON_MODE").toLowerCase();
  const headers: Record<string, string> = {};
  if (id === "openrouter") {
    headers["HTTP-Referer"] = env("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
    headers["X-Title"] = "ComplexityX";
  }

  return {
    id,
    label: preset.label,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    model,
    jsonMode: json === "false" || json === "off" ? "off" : json === "true" || json === "on" ? "on" : "auto",
    timeoutMs: Number(env("AI_TIMEOUT_MS")) || 60_000,
    temperature: env("AI_TEMPERATURE") ? Number(env("AI_TEMPERATURE")) : 0.2,
    headers,
    source: useClient ? "client" : "env",
  };
}

/** Safe, secret-free description for the Settings dialog. */
export function describeServerConfig() {
  const cfg = resolveProvider();
  return {
    engine: cfg ? ("ai" as const) : ("heuristic" as const),
    provider: cfg?.label ?? null,
    model: cfg?.model ?? null,
    allowClientKeys: env("ALLOW_CLIENT_KEYS") !== "false",
    presets: CLIENT_SELECTABLE.map((id) => ({
      id,
      label: PRESETS[id].label,
      defaultModel: PRESETS[id].defaultModel,
      free: PRESETS[id].free,
    })),
  };
}

export class ProviderError extends Error {
  constructor(public code: "auth" | "rate_limit" | "timeout" | "network" | "upstream" | "empty", message: string) {
    super(message);
  }
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function post(cfg: ProviderConfig, messages: ChatMessage[], json: boolean): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    return await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        ...cfg.headers,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        max_tokens: 6000,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ProviderError("timeout", "The AI provider took too long to respond.");
    throw new ProviderError("network", `Could not reach the AI provider (${(e as Error).message}).`);
  } finally {
    clearTimeout(timer);
  }
}

/** Calls an OpenAI-compatible chat endpoint. Retries once without `response_format` if the model rejects it. */
export async function chat(cfg: ProviderConfig, messages: ChatMessage[]): Promise<string> {
  let json = cfg.jsonMode !== "off";
  let res = await post(cfg, messages, json);

  if (!res.ok && json && cfg.jsonMode === "auto" && (res.status === 400 || res.status === 422 || res.status === 404)) {
    json = false;
    res = await post(cfg, messages, false);
  }

  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new ProviderError("auth", "The AI provider rejected the API key. Check it in Settings or .env.");
    if (res.status === 429) throw new ProviderError("rate_limit", "The AI provider rate-limited this request. Free tiers have low limits — wait a moment and retry.");
    throw new ProviderError("upstream", `The AI provider returned ${res.status}. ${body}`);
  }

  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string | { text?: string }[] } }[];
    error?: { message?: string };
  } | null;
  if (data?.error?.message) throw new ProviderError("upstream", data.error.message);

  const raw = data?.choices?.[0]?.message?.content;
  const content = Array.isArray(raw) ? raw.map((p) => p.text ?? "").join("") : raw;
  if (!content || !content.trim()) throw new ProviderError("empty", "The AI provider returned an empty response.");
  return content;
}
