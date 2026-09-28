import { NextRequest, NextResponse } from "next/server";
import { RequestSchema } from "@/lib/schema";
import { analyzeWithAI, AnalysisError } from "@/lib/analyzer";
import { analyzeHeuristic } from "@/lib/heuristic";
import { matchCurated } from "@/lib/curated";
import { describeServerConfig, resolveProvider } from "@/lib/provider";
import type { AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Tiny in-memory sliding-window rate limiter (per server instance). Swap for Redis/Upstash when scaling out. */
const hits = new Map<string, number[]>();
const LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE) || 20;
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const k of hits.keys()) { if (!hits.get(k)!.some((t) => now - t < 60_000)) hits.delete(k); }
  return recent.length > LIMIT;
}

const fail = (status: number, code: string, message: string, canFallback = false) =>
  NextResponse.json<AnalyzeResponse>({ ok: false, error: { code, message, canFallback } }, { status });

/** Secret-free description of the active engine — used by the Settings dialog. */
export async function GET() {
  return NextResponse.json(describeServerConfig());
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return fail(429, "rate_limited", "Too many analyses in a short time. Please wait a minute and try again.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "Request body must be valid JSON.");
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "Invalid request.");
  const input = parsed.data;

  // 1. Built-in examples: reviewed, instant, deterministic.
  const curated = matchCurated(input.code, input.language);
  if (curated) {
    return NextResponse.json<AnalyzeResponse>({ ok: true, analysis: curated.analysis, meta: { engine: "curated", generatedAt: Date.now() } });
  }

  // 2. Provider resolution (env first; optional browser-supplied key).
  const cfg = resolveProvider({
    provider: req.headers.get("x-cx-provider") ?? undefined,
    model: req.headers.get("x-cx-model") ?? undefined,
    apiKey: req.headers.get("x-cx-key") ?? undefined,
  });

  // 3. Offline engine when requested or when nothing is configured.
  if (input.engine === "heuristic" || !cfg) {
    try {
      const analysis = analyzeHeuristic(input);
      return NextResponse.json<AnalyzeResponse>({ ok: true, analysis, meta: { engine: "heuristic", generatedAt: Date.now() } });
    } catch (e) {
      console.error("[analyze] heuristic engine failed", e);
      return fail(500, "engine_error", "The offline engine could not analyze this code. Try simplifying it or configure an AI provider.");
    }
  }

  // 4. AI engine.
  try {
    const analysis = await analyzeWithAI(cfg, input);
    return NextResponse.json<AnalyzeResponse>({ ok: true, analysis, meta: { engine: "ai", provider: cfg.label, model: cfg.model, generatedAt: Date.now() } });
  } catch (e) {
    if (e instanceof AnalysisError) {
      const status = e.code === "rate_limit" ? 429 : e.code === "auth" ? 401 : e.code === "timeout" ? 504 : 502;
      return fail(status, e.code, e.message, true);
    }
    console.error("[analyze] unexpected failure", e);
    return fail(500, "internal", "Something went wrong while analyzing. Please try again.", true);
  }
}
