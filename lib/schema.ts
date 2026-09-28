import { z } from "zod";
import { prettyComplexity } from "./complexity";

/** Lenient coercion helpers — model output is untrusted and frequently slightly off-spec. */
const text = z.preprocess((v) => (v == null ? undefined : typeof v === "string" ? v : String(v)), z.string().default(""));
const required = z.preprocess(
  (v) => (v == null ? undefined : String(v).trim()),
  z.string().min(1, "must not be empty")
);
const num = z.preprocess((v) => {
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0;
}, z.number().int().default(0));
const bool = z.preprocess((v) => {
  if (typeof v === "string") return /^(true|yes|y|1)$/i.test(v.trim());
  return Boolean(v);
}, z.boolean());

/** An array that silently drops malformed items instead of failing the whole payload. */
const list = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((i) => item.safeParse(i).success) : []),
    z.array(item)
  ) as unknown as z.ZodType<z.output<T>[], z.ZodTypeDef, unknown>;
const strList = list(z.preprocess((v) => (v == null ? undefined : String(v)), z.string().min(1)));

const confidenceLevel = z.preprocess(
  (v) => {
    const s = String(v ?? "").toLowerCase();
    if (s.startsWith("h")) return "high";
    if (s.startsWith("l")) return "low";
    if (s.startsWith("e")) return "estimated";
    return "medium";
  },
  z.enum(["high", "medium", "low", "estimated"])
);

const optimalityKind = z.preprocess(
  (v) => {
    const s = String(v ?? "").toLowerCase().replace(/[\s-]+/g, "_");
    if (s.includes("prov") || s.includes("theor") || s.includes("lower")) return "provably_optimal";
    if (s.includes("assum") || s.includes("depend")) return "assumption_dependent";
    return "best_known";
  },
  z.enum(["provably_optimal", "best_known", "assumption_dependent"])
);

export const ApproachSchema = z.object({
  name: required,
  time: required,
  space: required,
  whenToUse: text,
  whyItWorks: text,
  tradeoffs: text,
  isCurrent: bool.default(false),
});

export const HotspotSchema = z.object({
  startLine: num,
  endLine: num,
  cost: text,
  label: text,
  explanation: text,
  snippet: text,
});

export const PatternSchema = z.object({
  name: required,
  why: text,
  status: z.preprocess((v) => (/detect|used|present|current/i.test(String(v ?? "")) ? "detected" : "suggested"), z.enum(["detected", "suggested"])),
});

export const AnalysisSchema = z.object({
  summary: text,
  timeComplexity: z.object({
    value: required,
    explanation: text,
    best: text,
    average: text,
    worst: text,
  }),
  spaceComplexity: z.object({
    value: required,
    explanation: text,
    inputSpace: text,
    auxiliarySpace: text,
    stackSpace: text,
    breakdown: list(z.object({ label: required, value: text, explanation: text })),
  }),
  confidence: z.object({ level: confidenceLevel, reason: text }).default({ level: "medium", reason: "" }),
  assumptions: strList,
  hotspots: list(HotspotSchema),
  patterns: list(PatternSchema),
  optimization: z
    .object({
      canImprove: bool,
      optimalityKind: optimalityKind,
      optimalityNote: text,
      targetTime: text,
      targetSpace: text,
      assumptions: strList,
      approaches: list(ApproachSchema),
      learningPath: strList,
      thinkingSteps: list(z.object({ title: required, detail: text })),
      hints: strList,
      whyFaster: text,
    })
    .default({} as never),
  optimizedCode: text,
  codeExplanation: strList,
  comparison: z
    .object({ optimizedTime: text, optimizedSpace: text, tradeoff: text })
    .default({ optimizedTime: "", optimizedSpace: "", tradeoff: "" }),
  edgeCases: list(z.object({ title: required, detail: text })),
});

export type Analysis = z.output<typeof AnalysisSchema>;
export type Approach = z.output<typeof ApproachSchema>;
export type Hotspot = z.output<typeof HotspotSchema>;

export const RequestSchema = z.object({
  language: z.enum(["java", "cpp", "python", "javascript"]),
  problemTitle: z.string().trim().max(120).optional().default(""),
  code: z.string().min(8, "Paste some code to analyze.").max(20_000, "Code is too long (limit 20,000 characters)."),
  engine: z.enum(["ai", "heuristic"]).optional(),
});
export type AnalyzeRequest = z.infer<typeof RequestSchema>;

/**
 * Post-validation cleanup shared by every engine: clamp line ranges to the submitted code,
 * pretty-print complexities, strip code fences, and fill in derivable gaps.
 */
export function finalizeAnalysis(a: Analysis, code: string): Analysis {
  const lineCount = code.split("\n").length;
  const clean = (s: string) => prettyComplexity(s);

  const hotspots = a.hotspots
    .map((h) => {
      const start = Math.min(Math.max(h.startLine, 1), lineCount);
      const end = Math.min(Math.max(h.endLine || start, start), lineCount);
      const valid = h.startLine >= 1 && h.startLine <= lineCount;
      return { ...h, startLine: valid ? start : 0, endLine: valid ? end : 0, cost: h.cost ? clean(h.cost) : "" };
    })
    .filter((h) => h.startLine > 0 || h.snippet);

  const stripFence = (s: string) =>
    s.replace(/^\s*```[a-zA-Z+#]*\n?/, "").replace(/\n?```\s*$/, "").replace(/\s+$/, "");

  const opt = a.optimization;
  const time = clean(a.timeComplexity.value);
  const space = clean(a.spaceComplexity.value);

  return {
    ...a,
    hotspots,
    timeComplexity: { ...a.timeComplexity, value: time },
    spaceComplexity: { ...a.spaceComplexity, value: space },
    optimization: {
      ...opt,
      targetTime: clean(opt.targetTime) || time,
      targetSpace: clean(opt.targetSpace) || space,
      approaches: opt.approaches.map((p) => ({ ...p, time: clean(p.time), space: clean(p.space) })),
    },
    comparison: {
      ...a.comparison,
      optimizedTime: clean(a.comparison.optimizedTime) || clean(opt.targetTime) || time,
      optimizedSpace: clean(a.comparison.optimizedSpace) || clean(opt.targetSpace) || space,
    },
    optimizedCode: stripFence(a.optimizedCode),
  };
}
