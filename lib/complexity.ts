/**
 * Complexity helpers: normalise free-text Big-O strings to a curve family,
 * evaluate relative growth for the chart, and rank complexities.
 * Everything here is theoretical — it never measures runtime.
 */

export type CurveId = "1" | "logn" | "sqrtn" | "n" | "nlogn" | "n2" | "n3" | "2n" | "nfact";
export type Tone = "good" | "warn" | "hot" | "bad";

export interface CurveDef {
  id: CurveId;
  label: string;
  rank: number;
  fn: (n: number) => number;
}

const cap = (x: number) => (Number.isFinite(x) ? Math.min(x, 1e18) : 1e18);

export const CURVES: Record<CurveId, CurveDef> = {
  "1": { id: "1", label: "O(1)", rank: 0, fn: () => 1 },
  logn: { id: "logn", label: "O(log n)", rank: 1, fn: (n) => Math.max(Math.log2(Math.max(n, 1)), 1) },
  sqrtn: { id: "sqrtn", label: "O(√n)", rank: 2, fn: (n) => Math.sqrt(n) },
  n: { id: "n", label: "O(n)", rank: 3, fn: (n) => n },
  nlogn: { id: "nlogn", label: "O(n log n)", rank: 4, fn: (n) => n * Math.max(Math.log2(Math.max(n, 1)), 1) },
  n2: { id: "n2", label: "O(n²)", rank: 5, fn: (n) => n * n },
  n3: { id: "n3", label: "O(n³)", rank: 6, fn: (n) => n * n * n },
  "2n": { id: "2n", label: "O(2ⁿ)", rank: 7, fn: (n) => cap(Math.pow(2, n)) },
  nfact: { id: "nfact", label: "O(n!)", rank: 8, fn: (n) => { let r = 1; for (let i = 2; i <= Math.min(n, 170); i++) r *= i; return cap(r); } },
};

export const CURVE_ORDER: CurveId[] = ["1", "logn", "n", "nlogn", "n2", "2n"];

export interface ParsedComplexity {
  id: CurveId;
  /** true when a multi-variable / unusual expression was mapped onto the closest single-variable family */
  approximate: boolean;
}

export function parseComplexity(raw: string): ParsedComplexity {
  const original = (raw || "").toLowerCase().replace(/\s+/g, "");
  let s = original
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/ⁿ/g, "^n")
    .replace(/\*\*/g, "^")
    .replace(/·|×|⋅/g, "*")
    .replace(/[θΘω]/gi, "o");
  const open = s.indexOf("(");
  const close = s.lastIndexOf(")");
  if (/^[oθ]\(/.test(s) && close > open) s = s.slice(open + 1, close);
  const t = s.replace(/[()]/g, "");

  if (!t) return { id: "n", approximate: true };
  if (t.includes("!")) return { id: "nfact", approximate: false };
  if (/\d\^[a-z]/.test(t) || /\^n\b/.test(t)) return { id: "2n", approximate: false };
  if (/\^([4-9]|\d{2})/.test(t)) return { id: "n3", approximate: true };
  if (/\^3|n\*n\*n/.test(t)) return { id: "n3", approximate: false };
  if (/[a-z]\*?log/.test(t) && !/^log/.test(t)) return { id: "nlogn", approximate: /[mkve]/.test(t) };
  if (/^log/.test(t)) return { id: "logn", approximate: false };
  if (/\^2|n\*n|[nmkve]\*[nmkve]/.test(t) && !/^\d+$/.test(t)) {
    return { id: "n2", approximate: !/^n(\^2|\*n)$/.test(t) };
  }
  if (/sqrt|√|\^0\.5/.test(t)) return { id: "sqrtn", approximate: false };
  if (/log/.test(t)) return { id: "logn", approximate: false };
  if (/^\d+$/.test(t) || /^(c|k)$/.test(t) || /const/.test(t)) return { id: "1", approximate: false };
  return { id: "n", approximate: !/^n$/.test(t) };
}

export function prettyComplexity(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  if (!/^[OΘ]\(/i.test(s) && !/^[Θθ]/.test(s)) s = `O(${s})`;
  return s
    .replace(/\^2/g, "²")
    .replace(/\^3/g, "³")
    .replace(/2\^n/gi, "2ⁿ")
    .replace(/\*\*/g, "^")
    .replace(/\s*\*\s*/g, " · ")
    .replace(/^o\(/, "O(");
}

export function rankOf(raw: string): number {
  return CURVES[parseComplexity(raw).id].rank;
}

export function toneOf(raw: string): Tone {
  const r = rankOf(raw);
  if (r <= 3) return "good";
  if (r === 4) return "warn";
  if (r === 5) return "hot";
  return "bad";
}

export const TONE_HEX: Record<Tone, string> = {
  good: "#34d399",
  warn: "#fbbf24",
  hot: "#fb923c",
  bad: "#f87171",
};

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-good",
  warn: "text-warn",
  hot: "text-hot",
  bad: "text-bad",
};

export const TONE_BG: Record<Tone, string> = {
  good: "bg-good/10 border-good/30 text-good",
  warn: "bg-warn/10 border-warn/30 text-warn",
  hot: "bg-hot/10 border-hot/30 text-hot",
  bad: "bg-bad/10 border-bad/30 text-bad",
};

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
const sup = (n: number) => String(n).split("").map((c) => SUP[c] ?? c).join("");

export function estimateOps(raw: string, n: number): number {
  return CURVES[parseComplexity(raw).id].fn(n);
}

export function formatOps(x: number): string {
  if (!Number.isFinite(x) || x >= 1e18) return "> 10¹⁸";
  if (x < 10_000) return Math.round(x).toLocaleString("en-US");
  const exp = Math.floor(Math.log10(x));
  const mant = x / Math.pow(10, exp);
  return `${mant.toFixed(1)} × 10${sup(exp)}`;
}

export function isImprovement(current: string, target: string): boolean {
  return rankOf(current) > rankOf(target);
}

export const SPACE_SCALE = ["O(1)", "O(log n)", "O(n)", "O(n²)"];
