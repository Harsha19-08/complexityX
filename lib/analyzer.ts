/**
 * AI analysis pipeline: prompt → model → extract JSON → validate → (one repair attempt) → normalise.
 * A failure at any stage surfaces as a typed AnalysisError; the caller renders an error state.
 */
import { AnalysisSchema, finalizeAnalysis, type Analysis, type AnalyzeRequest } from "./schema";
import { buildUserPrompt, numberLines, SYSTEM_PROMPT } from "./prompts";
import { chat, ProviderError, type ProviderConfig } from "./provider";

export class AnalysisError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Pull the first balanced JSON object out of a model reply (handles fences, <think> blocks, chatter). */
export function extractJson(raw: string): unknown {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  const start = s.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in the model response.");

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(start, i + 1).replace(/,\s*([}\]])/g, "$1"));
    }
  }
  throw new Error("The JSON object in the model response was truncated.");
}

function parseAndValidate(raw: string): { ok: true; value: Analysis } | { ok: false; problem: string } {
  let json: unknown;
  try {
    json = extractJson(raw);
  } catch (e) {
    return { ok: false, problem: (e as Error).message };
  }
  const parsed = AnalysisSchema.safeParse(json);
  if (!parsed.success) {
    const problem = parsed.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false, problem };
  }
  return { ok: true, value: parsed.data };
}

export async function analyzeWithAI(cfg: ProviderConfig, req: AnalyzeRequest): Promise<Analysis> {
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: buildUserPrompt(req.language, req.problemTitle, numberLines(req.code)) },
  ];

  let reply: string;
  try {
    reply = await chat(cfg, messages);
  } catch (e) {
    if (e instanceof ProviderError) throw new AnalysisError(e.code, e.message);
    throw e;
  }

  let result = parseAndValidate(reply);

  if (!result.ok) {
    // One repair attempt: show the model what was wrong.
    try {
      const repaired = await chat(cfg, [
        ...messages,
        { role: "assistant", content: reply.slice(0, 12_000) },
        {
          role: "user",
          content: `Your reply could not be used: ${result.problem}\nReturn the COMPLETE corrected JSON object only — no fences, no commentary. timeComplexity.value and spaceComplexity.value are required.`,
        },
      ]);
      result = parseAndValidate(repaired);
    } catch (e) {
      if (e instanceof ProviderError) throw new AnalysisError(e.code, e.message);
      throw e;
    }
  }

  if (!result.ok) {
    throw new AnalysisError(
      "malformed",
      `The model returned a response ComplexityX could not validate (${result.problem}). Try again, or pick a stronger model in Settings.`
    );
  }
  return finalizeAnalysis(result.value, req.code);
}
