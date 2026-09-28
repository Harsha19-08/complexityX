/**
 * Offline, rule-based static analyzer. Used when no AI provider is configured (or as an explicit fallback).
 *
 * It reads code STRUCTURE — loops, nesting, amortized pointer movement, recursion shape, sorting, common
 * container costs — and derives an estimate. It is deliberately conservative and labelled as such in its
 * confidence section. It does not generate optimized code: that needs the AI engine.
 */
import { AnalysisSchema, finalizeAnalysis, type Analysis } from "./schema";
import type { Language } from "./types";

/* ───────────────────────── cost algebra ───────────────────────── */

type Kind = "poly" | "graph" | "exp" | "fact";
interface Exp { kind: Kind; poly: number; log: number }
const ZERO: Exp = { kind: "poly", poly: 0, log: 0 };
const N1: Exp = { kind: "poly", poly: 1, log: 0 };
const LOG1: Exp = { kind: "poly", poly: 0, log: 1 };
const NLOGN: Exp = { kind: "poly", poly: 1, log: 1 };
const KR: Record<Kind, number> = { poly: 0, graph: 1, exp: 2, fact: 3 };
const cmp = (a: Exp, b: Exp) => KR[a.kind] - KR[b.kind] || a.poly - b.poly || a.log - b.log;
const maxE = (a: Exp, b: Exp) => (cmp(a, b) >= 0 ? a : b);
const mul = (a: Exp, b: Exp): Exp =>
  a.kind !== "poly" || b.kind !== "poly" ? maxE(a, b) : { kind: "poly", poly: a.poly + b.poly, log: a.log + b.log };

function bigO(e: Exp): string {
  if (e.kind === "exp") return "O(2^n)";
  if (e.kind === "fact") return "O(n!)";
  if (e.kind === "graph") return "O(V + E)";
  if (!e.poly && !e.log) return "O(1)";
  const p = e.poly === 0 ? "" : e.poly === 1 ? "n" : `n^${e.poly}`;
  const l = e.log === 0 ? "" : e.log === 1 ? "log n" : `log^${e.log} n`;
  return `O(${[p, l].filter(Boolean).join(" ")})`;
}

/* ───────────────────────── source preprocessing ───────────────────────── */

/** Replace comments and string contents with spaces (newlines preserved) so regexes never match inside them. */
function mask(code: string, lang: Language): string {
  let out = "";
  let i = 0;
  const n = code.length;
  const hashComment = lang === "python";
  while (i < n) {
    const c = code[i];
    const d = code[i + 1];
    if (!hashComment && c === "/" && d === "/") {
      while (i < n && code[i] !== "\n") { out += " "; i++; }
    } else if (!hashComment && c === "/" && d === "*") {
      out += "  "; i += 2;
      while (i < n && !(code[i] === "*" && code[i + 1] === "/")) { out += code[i] === "\n" ? "\n" : " "; i++; }
      out += "  "; i += 2;
    } else if (hashComment && c === "#") {
      while (i < n && code[i] !== "\n") { out += " "; i++; }
    } else if (c === '"' || c === "'" || (c === "`" && lang === "javascript")) {
      const q = c;
      out += q; i++;
      while (i < n && code[i] !== q && code[i] !== "\n") {
        if (code[i] === "\\") { out += " "; i++; }
        out += " "; i++;
      }
      out += q; i++;
    } else {
      out += c; i++;
    }
  }
  return out;
}

const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "return", "new", "else", "do", "try", "sizeof", "synchronized", "throw"]);
const idents = (s: string) => Array.from(new Set((s.match(/[A-Za-z_]\w*/g) ?? []).filter((w) => !KEYWORDS.has(w))));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ───────────────────────── structure ───────────────────────── */

interface Loop {
  id: number;
  kind: "for" | "while" | "iter";
  start: number; // 0-based line
  end: number;
  header: string;
  parent: number;
  children: number[];
  factor: "n" | "log" | "const" | "amortized";
  note: string;
}

interface Method { name: string; start: number; end: number; }

class Src {
  lines: string[];
  offsets: number[] = [];
  text: string;
  constructor(public masked: string, public lang: Language) {
    this.text = masked;
    this.lines = masked.split("\n");
    let o = 0;
    for (const l of this.lines) { this.offsets.push(o); o += l.length + 1; }
  }
  lineOf(offset: number) {
    let lo = 0, hi = this.lines.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.offsets[mid] <= offset) lo = mid; else hi = mid - 1; }
    return lo;
  }
  indent(i: number) { return (this.lines[i].match(/^\s*/) ?? [""])[0].replace(/\t/g, "    ").length; }
  slice(a: number, b: number) { return this.lines.slice(a, b + 1).join("\n"); }
}

/** Index of the char after the matching close for the bracket opening at `open`. */
function matchClose(t: string, open: number, o = "(", c = ")"): number {
  let d = 0;
  for (let i = open; i < t.length; i++) {
    if (t[i] === o) d++;
    else if (t[i] === c) { d--; if (d === 0) return i; }
  }
  return t.length - 1;
}

/** End offset of the statement/block following a header that closes at `after`. */
function bodyEnd(t: string, after: number): number {
  let i = after + 1;
  while (i < t.length && /\s/.test(t[i])) i++;
  if (t[i] === "{") return matchClose(t, i, "{", "}");
  let paren = 0, brace = 0;
  for (; i < t.length; i++) {
    const ch = t[i];
    if (ch === "(") paren++; else if (ch === ")") paren--;
    else if (ch === "{") brace++; else if (ch === "}") { brace--; if (brace < 0) return i; }
    else if (ch === ";" && paren === 0 && brace === 0) return i;
  }
  return t.length - 1;
}

function pyEnd(src: Src, i: number): number {
  const line = src.lines[i];
  // header ends at the last ':' outside brackets; anything after it means a single-line body
  let depth = 0, colon = -1;
  for (let k = 0; k < line.length; k++) {
    const ch = line[k];
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === ":" && depth === 0) colon = k;
  }
  if (colon >= 0 && line.slice(colon + 1).trim()) return i;
  const base = src.indent(i);
  let end = i;
  for (let j = i + 1; j < src.lines.length; j++) {
    if (!src.lines[j].trim()) continue;
    if (src.indent(j) > base) end = j; else break;
  }
  return end;
}

function findLoops(src: Src): Loop[] {
  const loops: Loop[] = [];
  const { lines, lang } = src;
  const py = lang === "python";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let kind: Loop["kind"] | null = null;
    let end = i;
    let header = line.trim();

    if (py) {
      const m = line.match(/^\s*(for|while)\b.*:/);
      if (m) { kind = m[1] === "for" ? "for" : "while"; end = pyEnd(src, i); }
      else if (/\[[^\]]*\bfor\b[^\]]*\bin\b/.test(line) || /\(\s*[^()]*\bfor\b[^()]*\bin\b[^()]*\)/.test(line)) { kind = "iter"; end = i; }
    } else {
      if (/^\s*\}\s*while\s*\(.*\)\s*;\s*$/.test(line)) continue; // do-while tail
      const m = line.match(/\b(for|while)\s*\(/);
      const arr = line.match(/\.(forEach|map|filter|reduce|some|every|flatMap|stream)\s*\(/);
      if (m && m.index !== undefined) {
        kind = m[1] === "for" ? "for" : "while";
        const open = src.offsets[i] + line.indexOf("(", m.index);
        const close = matchClose(src.text, open);
        header = src.text.slice(open + 1, close);
        end = src.lineOf(bodyEnd(src.text, close));
      } else if (arr && lang === "javascript" && arr.index !== undefined) {
        kind = "iter";
        const open = src.offsets[i] + line.indexOf("(", arr.index);
        end = src.lineOf(matchClose(src.text, open));
        header = line.trim();
      }
    }
    if (kind) loops.push({ id: loops.length, kind, start: i, end, header, parent: -1, children: [], factor: "n", note: "" });
  }

  // nesting
  const stack: Loop[] = [];
  for (const l of loops) {
    while (stack.length && !(stack[stack.length - 1].start <= l.start && stack[stack.length - 1].end >= l.end && (stack[stack.length - 1].start < l.start || stack[stack.length - 1].end > l.end))) stack.pop();
    if (stack.length) { l.parent = stack[stack.length - 1].id; stack[stack.length - 1].children.push(l.id); }
    stack.push(l);
  }
  return loops;
}

const MODIFY = (v: string) =>
  new RegExp(`(\\b${esc(v)}\\s*(\\+\\+|--|\\+=|-=|\\*=|/=|<<=|>>=|=(?!=))|(\\+\\+|--)\\s*${esc(v)}\\b|\\b${esc(v)}\\s*\\.\\s*(pop|poll|remove|removeFirst|removeLast|popleft|shift|pollFirst|pollLast|pop_back|pop_front|erase)\\s*\\()`);
const RESET = (v: string) =>
  new RegExp(`(\\b(int|long|var|let|const|auto|size_t|short)\\s+${esc(v)}\\b|\\b${esc(v)}\\s*=(?!=)|\\b${esc(v)}\\s*\\.\\s*clear\\s*\\(|\\b${esc(v)}\\s*=\\s*new\\b)`);

function classifyLoops(src: Src, loops: Loop[]) {
  const py = src.lang === "python";
  for (const l of loops) {
    const body = src.slice(l.start, l.end);
    const h = l.header;

    if (py && l.kind === "for") {
      const rng = h.match(/\brange\s*\(([^)]*)\)/);
      if (rng && rng[1].split(",").every((a) => /^\s*-?\d+\s*$/.test(a))) { l.factor = "const"; l.note = "constant range"; continue; }
      if (/\bin\s+["'\[(]/.test(h) && !/\bin\s+\[?\s*\w+\s*\]?\s*:/.test(h) && /\bin\s+\(?\s*[\d"']/.test(h)) { l.factor = "const"; continue; }
    }
    if (!py && l.kind === "for") {
      const parts = h.split(";");
      if (parts.length >= 3) {
        const [init, cond, upd] = parts;
        if (/=\s*-?\d+\s*$/.test(init.trim()) && /[<>]=?\s*-?\d+\s*$/.test(cond.trim()) && !/[a-zA-Z_]\w*\s*[<>]=?\s*[a-zA-Z_]/.test(cond)) {
          l.factor = "const"; l.note = "constant bound"; continue;
        }
        if (/\*=|\/=|<<=|>>=|=\s*\w+\s*[*/]\s*\d/.test(upd)) { l.factor = "log"; l.note = "index doubles/halves each step"; continue; }
      }
    }

    if (l.kind === "while") {
      const cond = py ? h.replace(/^\s*while\b/, "").replace(/:\s*$/, "") : h;
      const condVars = idents(cond);
      // halving / doubling a variable that appears in the condition
      const halve = Array.from(body.matchAll(/\b(\w+)\s*(?:\/=|>>=|\*=|<<=)\s*\d+/g)).some((m) => condVars.includes(m[1]))
        || Array.from(body.matchAll(/\b(\w+)\s*=\s*\1\s*[/*]\s*\d+/g)).some((m) => condVars.includes(m[1]))
        || Array.from(body.matchAll(/\b(\w+)\s*=\s*\1\s*(?:\/\/)\s*\d+/g)).some((m) => condVars.includes(m[1]));
      if (halve) { l.factor = "log"; l.note = "variable is halved/doubled each iteration"; continue; }
      if (/\bmid\b/.test(body) && /(=\s*mid\s*[+-]\s*1|=\s*mid\s*;|=\s*mid\s*$)/m.test(body)) {
        l.factor = "log"; l.note = "search range halves each iteration"; continue;
      }

      // amortized pointer: inner while whose driving variable is never reset by the enclosing loop
      if (l.parent >= 0) {
        const P = loops[l.parent];
        const before = src.slice(P.start + (py ? 1 : 0), l.start - 1 >= P.start ? l.start - 1 : P.start);
        const advancing = condVars.filter((v) => MODIFY(v).test(body));
        const driver = advancing.find((v) => !RESET(v).test(before));
        if (advancing.length && driver) {
          l.factor = "amortized";
          l.note = `\`${driver}\` only moves forward and is never reset by the outer loop`;
          continue;
        }
      }
    }
    l.factor = "n";
  }
}

/* ───────────────────────── methods & recursion ───────────────────────── */

const SIG_CPP_JAVA = /^\s*(?:(?:public|private|protected|static|final|synchronized|abstract|virtual|inline|constexpr)\s+)*[\w:<>\[\],.?&*]+(?:\s*[\w:<>\[\],.?&*]+)*\s+(\w+)\s*\(([^)]*)\)\s*(?:const)?\s*(?:throws\s+[\w,.\s]+)?\s*\{?\s*$/;

function findMethods(src: Src): Method[] {
  const out: Method[] = [];
  const { lines, lang } = src;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let name: string | null = null;
    if (lang === "python") {
      name = line.match(/^\s*def\s+(\w+)\s*\(/)?.[1] ?? null;
      if (name) out.push({ name, start: i, end: pyEnd(src, i) });
      continue;
    }
    if (lang === "javascript") {
      name =
        line.match(/^\s*(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/)?.[1] ??
        line.match(/^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>)/)?.[1] ??
        line.match(/^\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{\s*$/)?.[1] ??
        null;
    } else if (!/;\s*$/.test(line) && !/^\s*(return|else|new)\b/.test(line)) {
      name = line.match(SIG_CPP_JAVA)?.[1] ?? null;
    }
    if (!name || KEYWORDS.has(name)) continue;
    const off = src.offsets[i] + line.indexOf(name);
    const open = src.text.indexOf("(", off);
    const close = matchClose(src.text, open);
    const brace = src.text.indexOf("{", close);
    if (brace === -1) continue;
    const gap = src.text.slice(close + 1, brace);
    if (!/^\s*(const|noexcept|override|final|throws[\w,.\s]*|=>)?\s*$/.test(gap)) continue;
    out.push({ name, start: i, end: src.lineOf(matchClose(src.text, brace, "{", "}")) });
  }
  return out;
}

interface Recursion {
  method: Method;
  calls: number;
  callLines: number[];
  time: Exp;
  stack: Exp;
  recurrence: string;
  why: string;
  graph: boolean;
  memo: boolean;
  aux: Exp;
}

function analyzeRecursion(src: Src, methods: Method[], loops: Loop[], fullText: string): Recursion | null {
  let best: Recursion | null = null;
  for (const m of methods) {
    const callRe = new RegExp(`\\b${esc(m.name)}\\s*\\(`);
    const callLines: number[] = [];
    let calls = 0;
    for (let i = m.start + 1; i <= m.end; i++) {
      const c = (src.lines[i].match(new RegExp(callRe.source, "g")) ?? []).length;
      if (c) { calls += c; callLines.push(i); }
    }
    if (!calls) continue;

    const body = src.slice(m.start, m.end);
    const callText = callLines.map((i) => src.lines[i]).join("\n");
    const inLoop = callLines.some((ln) => loops.some((l) => l.start <= ln && l.end >= ln && l.start > m.start && l.end <= m.end));
    const loopsInside = loops.filter((l) => l.start > m.start && l.end <= m.end);
    const loopCost = loopsInside.filter((l) => l.parent < 0 || loops[l.parent].start <= m.start).reduce((acc, l) => maxE(acc, loopCostOf(loops, l)), ZERO);
    const halving = /\bmid\b|\/\s*2\b|>>\s*1\b|\/\/\s*2\b|\(\s*\w+\s*\+\s*\w+\s*\)\s*\/\s*2/.test(callText) || /\bmid\b\s*[-+]/.test(callText);
    const memoDims = (() => {
      const mm = fullText.match(/\b(memo|cache|dp|memoized|seen)\b((?:\s*\[[^\]]*\]){1,3})/);
      return mm ? (mm[2].match(/\[/g) ?? []).length : 0;
    })();
    const memo = memoDims > 0 || /\b(memo|cache)\b|lru_cache|@cache|computeIfAbsent|\bmemoize\b/i.test(fullText);
    const graph = /\bvisited\b|\bseen\b/.test(body + fullText) && /\b(adj|graph|neighbors|edges|children|next)\b/.test(body);
    let rec: Recursion;

    if (graph) {
      rec = { method: m, calls, callLines, time: { kind: "graph", poly: 0, log: 0 }, stack: N1, recurrence: "each vertex visited once, each edge examined once", why: "A visited set prevents revisiting nodes, so work is proportional to vertices + edges.", graph: true, memo: false, aux: N1 };
    } else if (memo && !halving) {
      const dims = Math.max(memoDims, 1);
      rec = { method: m, calls, callLines, time: mul({ kind: "poly", poly: dims, log: 0 }, loopCost), stack: N1, recurrence: `${dims === 1 ? "n" : `n^${dims}`} distinct states × work per state`, why: "Results are cached, so each distinct state is computed once instead of exponentially many times.", graph: false, memo: true, aux: { kind: "poly", poly: dims, log: 0 } };
    } else if (halving && !inLoop) {
      if (calls === 1) {
        const t = mul(LOG1, loopCost.poly ? { kind: "poly", poly: 0, log: 0 } : ZERO);
        rec = { method: m, calls, callLines, time: loopCost.poly ? loopCost : t, stack: LOG1, recurrence: loopCost.poly ? "T(n) = T(n/2) + O(n)" : "T(n) = T(n/2) + O(1)", why: "One recursive call on half the input each level.", graph: false, memo, aux: ZERO };
      } else {
        rec = { method: m, calls, callLines, time: loopCost.poly ? NLOGN : N1, stack: LOG1, recurrence: loopCost.poly ? "T(n) = 2T(n/2) + O(n)" : "T(n) = 2T(n/2) + O(1)", why: loopCost.poly ? "Two half-size subproblems plus a linear merge/scan at each level (Master theorem case 2)." : "Two half-size subproblems with constant work per call.", graph: false, memo, aux: loopCost.poly ? N1 : ZERO };
      }
    } else if (inLoop) {
      const perm = /\b(used|visited|swap)\b/.test(body);
      rec = { method: m, calls, callLines, time: { kind: perm ? "fact" : "exp", poly: 0, log: 0 }, stack: N1, recurrence: perm ? "n choices, then n−1, then n−2 … → n!" : "each level branches into up to n further calls", why: "The recursive call sits inside a loop, so the branching factor multiplies at every level (backtracking).", graph: false, memo, aux: ZERO };
    } else if (calls === 1) {
      rec = { method: m, calls, callLines, time: mul(N1, loopCost), stack: N1, recurrence: loopCost.poly ? "T(n) = T(n−1) + O(n)" : "T(n) = T(n−1) + O(1)", why: "One recursive call that shrinks the input by a constant; the call chain is n deep.", graph: false, memo, aux: ZERO };
    } else {
      rec = { method: m, calls, callLines, time: { kind: "exp", poly: 0, log: 0 }, stack: N1, recurrence: "T(n) = T(n−1) + T(n−2) + O(1) (or similar)", why: `${calls} recursive calls per invocation with no caching: the call tree roughly doubles at each level.`, graph: false, memo: false, aux: ZERO };
    }
    if (!best || cmp(rec.time, best.time) > 0) best = rec;
  }
  return best;
}

/* ───────────────────────── leaves (hidden costs) ───────────────────────── */

interface Leaf { line: number; label: string; exp: Exp; note: string; loopId: number }

function isListVar(fullText: string, name: string): boolean {
  const n = esc(name);
  return new RegExp(`\\b(List|ArrayList|LinkedList|Vector|Deque|ArrayDeque|vector|list)\\b[^;=\\n(]*\\b${n}\\b\\s*(=|;|\\)|\\()`).test(fullText)
    || new RegExp(`\\b${n}\\s*=\\s*(\\[|list\\()`).test(fullText);
}

function findLeaves(src: Src, loops: Loop[], fullText: string): Leaf[] {
  const leaves: Leaf[] = [];
  const innermost = (i: number) => {
    let best = -1;
    for (const l of loops) if (l.start <= i && l.end >= i && (best < 0 || l.start >= loops[best].start)) best = l.id;
    return best;
  };
  src.lines.forEach((line, i) => {
    const loopId = innermost(i);
    const push = (label: string, exp: Exp, note: string) => leaves.push({ line: i, label, exp, note, loopId });
    if (/\b(Arrays|Collections)\s*\.\s*sort\s*\(|\bstd::sort\s*\(|\bsort\s*\(\s*\w+\.begin|\.sort\s*\(|\bsorted\s*\(/.test(line)) push("Sorting", NLOGN, "Comparison sorting costs O(n log n).");
    const lin = line.match(/\.(indexOf|lastIndexOf|includes)\s*\(/);
    if (lin) push(`${lin[1]}()`, N1, `\`${lin[1]}\` scans linearly.`);
    const cont = line.match(/(\w+)\s*\.\s*contains\s*\(/);
    if (cont && isListVar(fullText, cont[1])) push("List.contains()", N1, `\`${cont[1]}\` is a list — membership test scans it (use a HashSet for O(1) average).`);
    const pyIn = src.lang === "python" ? line.match(/\bif\b.*\b(?:not\s+)?in\s+(\w+)\s*[:)]/) : null;
    if (pyIn && !/\bfor\b/.test(line) && isListVar(fullText, pyIn[1])) push("`in` on a list", N1, `\`${pyIn[1]}\` is a list — membership test scans it (use a set).`);
    if (/\.(substring|slice|copyOf|copyOfRange|clone|toCharArray|split)\s*\(|Arrays\s*\.\s*copyOf|\bstr\s*\(\s*\w+\s*\)|\blist\s*\(\s*\w+\s*\)/.test(line) && loopId >= 0) push("Copying a slice", N1, "Slicing/copying creates a new O(length) array or string.");
    if (/\.(add|insert)\s*\(\s*0\s*,|\.pop\s*\(\s*0\s*\)|\.shift\s*\(\s*\)|\.unshift\s*\(|\.remove\s*\(\s*0\s*\)/.test(line)) push("Front insert/remove", N1, "Inserting/removing at index 0 of an array-backed list shifts every element.");
    const cat = line.match(/\b(\w+)\s*\+=\s*[^=]/);
    if (cat && loopId >= 0 && new RegExp(`\\bString\\s+${esc(cat[1])}\\b|\\b${esc(cat[1])}\\s*=\\s*(""|'')|\\bstring\\s+${esc(cat[1])}\\b`).test(fullText) && !/\bint\b|\blong\b/.test(line)) push("String concatenation", N1, "Repeated `+=` on strings copies the whole string each time.");
    if (/Arrays\s*\.\s*fill\s*\(|\bfill\s*\(/.test(line) && loopId >= 0) push("fill()", N1, "fill touches every element of the array.");
  });
  return leaves;
}

/* ───────────────────────── cost roll-up ───────────────────────── */

let LEAVES: Leaf[] = [];
function loopCostOf(loops: Loop[], l: Loop): Exp {
  const own: Exp = l.factor === "n" ? N1 : l.factor === "log" ? LOG1 : ZERO;
  let inner = ZERO;
  for (const c of l.children) inner = maxE(inner, loopCostOf(loops, loops[c]));
  for (const lf of LEAVES) if (lf.loopId === l.id) inner = maxE(inner, lf.exp);
  return mul(own, inner);
}

/* ───────────────────────── space ───────────────────────── */

interface SpaceItem { label: string; exp: Exp; explanation: string }

function analyzeSpace(src: Src, loops: Loop[], recursion: Recursion | null, hasSort: string | null, fullText: string): SpaceItem[] {
  const items: SpaceItem[] = [];
  const lang = src.lang;
  const inLoop = (i: number) => loops.some((l) => l.start <= i && l.end >= i) || (recursion ? i >= recursion.method.start && i <= recursion.method.end : false);
  const add = (label: string, exp: Exp, explanation: string) => { if (!items.some((x) => x.label === label)) items.push({ label, exp, explanation }); };
  const isConstNum = (s: string) => /^\s*\d+\s*$/.test(s) && parseInt(s, 10) <= 1024;

  const grows = (v: string, re: string) => {
    const r = new RegExp(`\\b${esc(v)}\\b\\s*(?:\\.|\\[)\\s*(?:${re})`);
    return src.lines.some((ln, i) => r.test(ln) && inLoop(i));
  };

  src.lines.forEach((line) => {
    // Java / JS / C++ arrays
    for (const m of line.matchAll(/new\s+(?:[\w.]+)\s*((?:\[\s*[^\]]*\s*\])+)/g)) {
      const dims = Array.from(m[1].matchAll(/\[\s*([^\]]*)\s*\]/g)).map((d) => d[1]).filter((d) => d.trim() !== "");
      if (!dims.length) continue;
      const constant = dims.every(isConstNum);
      const label = `array${m[1].replace(/\s+/g, "")}`;
      add(label, constant ? ZERO : { kind: "poly", poly: dims.filter((d) => !isConstNum(d)).length, log: 0 }, constant ? "Fixed-size array — does not grow with input." : `Allocates ${dims.length}-dimensional storage sized by the input.`);
    }
    if (lang === "javascript") {
      for (const m of line.matchAll(/new\s+Array\s*\(\s*([^)]*)\)|Array\s*\(\s*([^)]*)\)\s*\.fill/g)) {
        const sz = (m[1] ?? m[2] ?? "").trim();
        if (sz) add("Array(n)", isConstNum(sz) ? ZERO : N1, isConstNum(sz) ? "Fixed-size array." : "Array sized by the input.");
      }
    }
    // C++ vectors
    for (const m of line.matchAll(/vector\s*<\s*(?:vector\s*<[^>]*>|[^>]+)\s*>\s*(\w+)\s*\(\s*([^,)]*)(?:,\s*(.*))?\)/g)) {
      const two = /vector\s*<[^>]*>\s*>/.test(line) || /vector\s*<\s*vector/.test(line);
      const constant = isConstNum(m[2]);
      add(`vector ${m[1]}`, constant ? ZERO : { kind: "poly", poly: two ? 2 : 1, log: 0 }, constant ? "Fixed-size vector." : `${two ? "2-D " : ""}vector sized by the input.`);
    }
    // Python allocations
    if (lang === "python") {
      const m = line.match(/(\w+)\s*=\s*\[\s*(?:\[?\s*[^\]]*\]?)\s*\]\s*\*\s*(\w+)/);
      if (m && !/^\d+$/.test(m[2])) add(`${m[1]} = [..] * ${m[2]}`, N1, "List pre-allocated to the input size.");
      const mm = line.match(/(\w+)\s*=\s*\[\s*\[[^\]]*\]\s*\*\s*\w+\s+for\b[^\]]*range\s*\(\s*(\w+)\s*\)\s*\]/);
      if (mm && !/^\d+$/.test(mm[2])) add(`${mm[1]} (2-D list)`, { kind: "poly", poly: 2, log: 0 }, "2-D table sized by the input.");
    }
  });

  // dynamic containers: only O(n) if elements are inserted repeatedly
  const containerDecls: { v: string; type: string }[] = [];
  for (const m of fullText.matchAll(/(?:\b(HashMap|HashSet|TreeMap|TreeSet|ArrayList|LinkedList|ArrayDeque|Stack|PriorityQueue|LinkedHashMap|LinkedHashSet|Vector|Deque|List|Map|Set|Queue)\b\s*<[^;=\n]*>\s+(\w+)\s*=)|(?:\b(unordered_map|unordered_set|map|set|multiset|stack|queue|priority_queue|deque|vector)\s*<[^;=\n]*>\s+(\w+)\s*;)|(?:\b(\w+)\s*=\s*(?:new\s+(Map|Set|Array)\s*\(\s*\)|\[\s*\]|\{\s*\}|set\s*\(\s*\)|dict\s*\(\s*\)|list\s*\(\s*\)|defaultdict\s*\([^)]*\)|deque\s*\(\s*\)|Counter\s*\(\s*\)))/g)) {
    const v = m[2] || m[4] || m[5];
    const type = m[1] || m[3] || m[6] || "container";
    if (v) containerDecls.push({ v, type });
  }
  for (const { v, type } of containerDecls) {
    const inserts = "put|add|push|push_back|offer|append|appendleft|addLast|addFirst|computeIfAbsent|merge|putIfAbsent|insert|emplace|emplace_back|set|update|extend";
    const idxAssign = new RegExp(`\\b${esc(v)}\\s*\\[[^\\]]*\\]\\s*(=|\\+=|\\+\\+)`);
    const inserted = grows(v, inserts) || src.lines.some((ln, i) => idxAssign.test(ln) && inLoop(i));
    if (inserted) add(`${v} (${type})`, N1, `\`${v}\` receives elements inside a loop/recursion, so it can hold up to n entries.`);
  }

  if (/\.(toCharArray|split|copyOf|copyOfRange|clone|slice)\s*\(|\bsorted\s*\(|\bArrays\s*\.\s*copyOf|\blist\s*\(\s*\w+\s*\)/.test(fullText)) add("copy of input", N1, "A defensive/derived copy of the input is created.");
  if (hasSort) add("sort", /Arrays\s*\.\s*sort|std::sort|sort\s*\(\s*\w+\.begin/.test(fullText) ? LOG1 : N1, "Built-in sort auxiliary space (introsort/quicksort stack O(log n); TimSort O(n)) — implementation dependent.");
  if (recursion) add("recursion stack", recursion.stack, `Recursion depth grows as ${bigO(recursion.stack)}.`);
  if (recursion && recursion.aux.poly) add("memo / DP table", recursion.aux, "Cache holds one entry per distinct state.");
  if (recursion?.graph) add("visited set", N1, "Tracks up to V vertices.");
  return items;
}

/* ───────────────────────── main ───────────────────────── */

export function analyzeHeuristic(req: { language: Language; code: string; problemTitle?: string }): Analysis {
  const { language, code } = req;
  const masked = mask(code, language);
  const src = new Src(masked, language);
  const fullText = masked;

  const loops = findLoops(src);
  classifyLoops(src, loops);
  LEAVES = findLeaves(src, loops, fullText);
  const methods = findMethods(src);
  const recursion = analyzeRecursion(src, methods, loops, fullText);

  // time
  let time = ZERO;
  const roots = loops.filter((l) => l.parent < 0);
  for (const r of roots) time = maxE(time, loopCostOf(loops, r));
  for (const lf of LEAVES) if (lf.loopId < 0) time = maxE(time, lf.exp);
  if (recursion) time = maxE(time, recursion.time);
  const sortLeaf = LEAVES.find((l) => l.label === "Sorting");

  // dominant loop chain for hotspots
  const chainOf = (l: Loop): Loop[] => {
    const kids = l.children.map((c) => loops[c]);
    if (!kids.length) return [l];
    const dom = kids.reduce((a, b) => (cmp(loopCostOf(loops, a), loopCostOf(loops, b)) >= 0 ? a : b));
    return [l, ...chainOf(dom)];
  };
  const domRoot = roots.length ? roots.reduce((a, b) => (cmp(loopCostOf(loops, a), loopCostOf(loops, b)) >= 0 ? a : b)) : null;
  const chain = domRoot ? chainOf(domRoot) : [];
  const maxDepth = chain.length;

  // space
  const spaceItems = analyzeSpace(src, loops, recursion, sortLeaf ? "sort" : null, fullText);
  let space = ZERO;
  for (const s of spaceItems) space = maxE(space, s.exp);
  const stackExp = recursion ? recursion.stack : ZERO;
  const auxExp = spaceItems.filter((s) => s.label !== "recursion stack").reduce((a, s) => maxE(a, s.exp), ZERO);

  /* ── facts for pattern detection ── */
  const has = (re: RegExp) => re.test(fullText);
  const amortized = loops.filter((l) => l.factor === "amortized");
  const binary = loops.some((l) => l.factor === "log" && /\bmid\b/.test(src.slice(l.start, l.end)));
  const kadane = has(/max\s*\(\s*\w+\s*\[\s*\w+\s*\]\s*,\s*\w+\s*\+\s*\w+\s*\[\s*\w+\s*\]\s*\)/) || has(/max\s*\(\s*\w+\s*\+\s*\w+\s*\[\s*\w+\s*\]\s*,\s*\w+\s*\[\s*\w+\s*\]\s*\)/);
  const hashy = has(/\b(HashMap|HashSet|unordered_map|unordered_set|LinkedHashMap|Map|Set|dict|defaultdict|Counter|set)\b\s*[<(]/) || has(/=\s*(\{\s*\}|set\s*\(\s*\)|dict\s*\(\s*\))/);
  const heap = has(/PriorityQueue|heapq|priority_queue/);
  const stackDs = has(/\bStack\b|\bstack\b|ArrayDeque|Deque|deque/);
  const queueBfs = has(/\b(Queue|queue|deque|LinkedList)\b/) && has(/\.(poll|popleft|shift|pop)\s*\(\s*\)|\.front\s*\(\)/) && has(/\bvisited\b|\bseen\b/);
  const dpArr = has(/\b(dp|memo|table)\b\s*\[/);
  const prefix = has(/\b(prefix|pre|cumsum|pref|prefixSum)\b\s*(\[|=)/i);
  const nested = maxDepth >= 2 && chain.slice(1).some((l) => l.factor === "n");
  const pairSum = nested && has(/\w+\s*\[\s*\w+\s*\]\s*\+\s*\w+\s*\[\s*\w+\s*\]\s*(==|===)/);
  const rangeAccum = nested && chain.slice(1).some((l) => /\b\w+\s*\+=\s*\w+\s*\[/.test(src.slice(l.start, l.end)));
  const nextGreater = nested && chain.slice(1).some((l) => /\b\w+\s*\[\s*\w+\s*\]\s*[<>]=?\s*\w+\s*\[\s*\w+\s*\]/.test(src.slice(l.start, l.end)) && /\bbreak\b/.test(src.slice(l.start, l.end)));
  const listContains = LEAVES.some((l) => (l.label === "List.contains()" || l.label === "`in` on a list" || l.label === "indexOf()" || l.label === "includes()") && l.loopId >= 0);
  const concat = LEAVES.some((l) => l.label === "String concatenation");
  const sortedHint = /sorted|non-?decreasing|ascending/i.test(`${req.problemTitle ?? ""} ${code}`);
  const linearSearchShape = !nested && loops.some((l) => l.factor === "n" && /return\s+\w+\s*;?\s*$/m.test(src.slice(l.start, l.end)) && /\[\s*\w+\s*\]\s*==\s*\w+/.test(src.slice(l.start, l.end)));

  /* ── patterns ── */
  const patterns: { name: string; status: "detected" | "suggested"; why: string }[] = [];
  const det = (name: string, why: string) => patterns.push({ name, status: "detected", why });
  const sug = (name: string, why: string) => patterns.push({ name, status: "suggested", why });

  if (kadane) det("Kadane's Algorithm", "The 'extend or restart' recurrence max(x, current + x) is Kadane's algorithm.");
  if (binary) det("Binary Search", "A mid index and a range that halves each iteration.");
  if (amortized.length) det(has(/\b(left|right|lo|hi|start|end|l|r)\b/) ? "Sliding Window" : "Two Pointers", `A nested loop whose pointer only advances (${amortized[0].note}) — total work stays linear.`);
  if (amortized.length && stackDs && has(/\.(pop|poll|removeLast|pop_back)\s*\(/)) det("Monotonic Stack", "Elements are popped while a condition holds, and each element is pushed/popped at most once.");
  if (hashy && !heap) det("HashMap / Frequency Map", "Uses hash-based containers for constant-average-time lookup/insert.");
  if (heap) det("Heap / Priority Queue", "A priority queue keeps the best candidate available in O(log n).");
  if (recursion?.memo || dpArr) det("Dynamic Programming", "Sub-results are stored and reused instead of recomputed.");
  if (recursion && !recursion.memo && !recursion.graph && !recursion.method.name.match(/dfs/i) && recursion.calls >= 2 && recursion.time.kind === "poly") det("Divide and Conquer", "The problem is split into smaller independent subproblems.");
  if (recursion?.graph || (has(/\bdfs\b/i) && recursion)) det("DFS", "Recursive traversal with a visited set.");
  if (queueBfs) det("BFS", "A queue drives level-by-level traversal with a visited set.");
  if (recursion && cmp(recursion.time, { kind: "poly", poly: 9, log: 0 }) > 0 && recursion.time.kind !== "graph") det("Backtracking", "Recursive exploration of choices, undoing each after trying it.");
  if (prefix) det("Prefix Sum", "Running totals are precomputed so range sums are O(1).");
  if (sortLeaf) det("Sorting", "Sorts the input, typically to enable order-based reasoning (two pointers, binary search, greedy).");

  // suggestions
  const approaches: Analysis["optimization"]["approaches"] = [];
  const addApproach = (a: Analysis["optimization"]["approaches"][number]) => { if (!approaches.some((x) => x.name === a.name)) approaches.push(a); };
  const hints: string[] = [];
  const targets: { time: string; space: string }[] = [];
  let mainSuggestion = "";

  if (pairSum) {
    mainSuggestion = "HashMap";
    sug("HashMap / Frequency Map", "The inner loop searches for a partner value that is fully determined by the outer element (target − x). A hash map turns that search into an O(1) average lookup.");
    sug("Two Pointers", "If the data is (or can be) sorted, two pointers moving inward find a pair in O(n) after sorting.");
    addApproach({ name: "HashMap (one pass)", time: "O(n)", space: "O(n)", isCurrent: false, whenToUse: "Unsorted input where original indices are needed.", whyItWorks: "Store values seen so far; for each element look up its complement.", tradeoffs: "O(n) extra memory; relies on average-case O(1) hashing." });
    addApproach({ name: "Sort + Two Pointers", time: "O(n log n)", space: "O(1)", isCurrent: false, whenToUse: "Input already sorted, or only values (not indices) are needed.", whyItWorks: "In sorted order, move the pointer whose value makes the sum too small/large.", tradeoffs: "Sorting costs O(n log n) and loses original indices unless copied (extra memory)." });
    targets.push({ time: "O(n)", space: "O(n)" });
    hints.push("The inner loop searches for a value that is completely determined by the outer element. What is it?", "Could you remember values you have already visited instead of rescanning them?", "Think HashMap: check for the complement before inserting the current value.");
  } else if (rangeAccum) {
    mainSuggestion = "Prefix Sum + HashMap";
    sug("Prefix Sum", "The inner loop re-accumulates range sums that overlap across outer iterations; prefix[j] − prefix[i] gives any range sum in O(1).");
    sug("HashMap / Frequency Map", "If you are looking for ranges with a specific sum, store earlier prefix sums in a map and look up (current − target).");
    sug("Sliding Window", "Only valid when all values are non-negative — the window sum is then monotonic.");
    addApproach({ name: "Prefix Sum + HashMap", time: "O(n)", space: "O(n)", isCurrent: false, whenToUse: "Range-sum conditions on arrays that may include negatives.", whyItWorks: "sum(i..j) = prefix[j+1] − prefix[i]; a map of earlier prefixes replaces the inner loop.", tradeoffs: "O(n) memory; watch integer overflow in prefix sums." });
    addApproach({ name: "Sliding Window", time: "O(n)", space: "O(1)", isCurrent: false, whenToUse: "Only when all elements are non-negative.", whyItWorks: "Expand right to grow the sum, shrink left to reduce it; pointers never move backwards.", tradeoffs: "Incorrect when negative values are possible." });
    targets.push({ time: "O(n)", space: "O(n)" });
    hints.push("Look for repeated work: how often is the same partial sum recomputed by different starting indices?", "Can a range sum be expressed as the difference of two running totals?", "Think Prefix Sum, and a HashMap of previously seen prefix values.");
  } else if (nextGreater) {
    mainSuggestion = "Monotonic Stack";
    sug("Monotonic Stack", "The inner loop scans forward for the next larger/smaller element and breaks. A stack of unresolved indices resolves each element exactly once.");
    addApproach({ name: "Monotonic Stack", time: "O(n)", space: "O(n)", isCurrent: false, whenToUse: "'Next greater/smaller element' style questions.", whyItWorks: "Keep indices whose answer is unknown; each new element resolves and pops smaller ones. Every index is pushed/popped at most once.", tradeoffs: "O(n) stack memory in the worst case." });
    targets.push({ time: "O(n)", space: "O(n)" });
    hints.push("Look for repeated work: many indices rescan the same stretch of the array.", "Which elements are still waiting for their answer when you reach index i?", "Think Monotonic Stack.");
  } else if (recursion && !recursion.memo && !recursion.graph && (recursion.time.kind === "exp" || recursion.time.kind === "fact") && !recursion.callLines.some((ln) => loops.some((l) => l.start <= ln && l.end >= ln))) {
    mainSuggestion = "Memoization";
    sug("Memoization", "The same arguments are recomputed by different branches of the recursion tree. Caching results per argument collapses the exponential tree to the number of distinct states.");
    sug("Dynamic Programming", "Convert the recursion to bottom-up tabulation; often the table can be shrunk to O(1) or O(n) space.");
    addApproach({ name: "Memoization (top-down DP)", time: "O(n · m)", space: "O(n · m)", isCurrent: false, whenToUse: "Overlapping subproblems with a small number of distinct states.", whyItWorks: "Each distinct state is computed once and reused.", tradeoffs: "Extra memory for the cache and recursion stack; exact bound = #states × work per state." });
    addApproach({ name: "Tabulation (bottom-up DP)", time: "O(n · m)", space: "O(n · m)", isCurrent: false, whenToUse: "When you can order the states; enables space optimisation.", whyItWorks: "Fills a table from base cases upward, avoiding recursion.", tradeoffs: "Must define state order explicitly; may be tricky for sparse states." });
    targets.push({ time: "O(n · m)", space: "O(n · m)" });
    hints.push("Which calls receive the same arguments more than once?", "What if you stored each result the first time you computed it?", "Think Memoization → Dynamic Programming.");
  } else if (recursion && (recursion.time.kind === "exp" || recursion.time.kind === "fact")) {
    mainSuggestion = "Pruning";
    sug("Backtracking", "Exponential/factorial growth is inherent to enumerating all choices; the lever is pruning branches early or caching overlapping states.");
    addApproach({ name: "Pruned backtracking", time: bigO(recursion.time), space: "O(n)", isCurrent: false, whenToUse: "When all solutions must be enumerated or a good bound lets you cut branches.", whyItWorks: "Skip branches that cannot lead to a valid/better answer.", tradeoffs: "Worst case remains exponential; gains depend on the input." });
    targets.push({ time: bigO(recursion.time), space: "O(n)" });
    hints.push("Can any branch be rejected before exploring it?", "Do different branches reach identical sub-states you could cache?", "Think pruning and memoization.");
  } else if (listContains) {
    mainSuggestion = "HashSet";
    sug("HashMap / Frequency Map", "A linear-time membership test (contains / indexOf / in list) sits inside a loop. A hash set answers membership in O(1) average.");
    addApproach({ name: "HashSet for membership", time: "O(n)", space: "O(n)", isCurrent: false, whenToUse: "Repeated membership queries.", whyItWorks: "Hashing jumps directly to the bucket instead of scanning.", tradeoffs: "Extra memory; average-case guarantee only; loses element order." });
    targets.push({ time: "O(n)", space: "O(n)" });
    hints.push("Which call inside the loop is secretly O(n)?", "What data structure answers 'have I seen this?' in constant time?", "Think HashSet.");
  } else if (concat) {
    mainSuggestion = "StringBuilder";
    sug("Greedy", "Not needed — the cost comes from copying the growing string each iteration. Build with a StringBuilder / list-join instead.");
    addApproach({ name: "StringBuilder / list join", time: "O(n)", space: "O(n)", isCurrent: false, whenToUse: "Building strings in a loop.", whyItWorks: "Appends into a growable buffer instead of copying.", tradeoffs: "Slightly more code." });
    targets.push({ time: "O(n)", space: "O(n)" });
    hints.push("What happens to the string each time you use +=?", "How many characters get copied in total?", "Use a mutable buffer.");
  } else if (sortedHint && linearSearchShape) {
    mainSuggestion = "Binary Search";
    sug("Binary Search", "A linear scan over data described as sorted ignores the ordering; binary search discards half of the range per comparison.");
    addApproach({ name: "Binary Search", time: "O(log n)", space: "O(1)", isCurrent: false, whenToUse: "Sorted, random-access data.", whyItWorks: "Each comparison rules out half of the remaining candidates.", tradeoffs: "Requires sorted input." });
    targets.push({ time: "O(log n)", space: "O(1)" });
    hints.push("Is the input's ordering being used?", "How many candidates can one comparison rule out?", "Think Binary Search.");
  } else if (nested && cmp(time, { kind: "poly", poly: 2, log: 0 }) >= 0) {
    mainSuggestion = "Remove repeated work";
    sug("HashMap / Frequency Map", "Nested loops usually re-derive information the outer loop already saw. Storing it (value → index / count) replaces the inner scan with a lookup.");
    sug("Prefix Sum", "If the inner loop accumulates over a range, prefix sums make each range O(1).");
    sug("Two Pointers", "If order matters or the data can be sorted, two pointers often replace a pair of nested loops.");
    addApproach({ name: "Precompute + lookup (HashMap / prefix)", time: "O(n)", space: "O(n)", isCurrent: false, whenToUse: "The inner loop searches or sums something the outer loop could have remembered.", whyItWorks: "Trade memory for time: store what you have already computed.", tradeoffs: "Extra memory; depends on the specific problem structure." });
    addApproach({ name: "Sort + Two Pointers", time: "O(n log n)", space: "O(1)", isCurrent: false, whenToUse: "Order-independent problems or already-sorted input.", whyItWorks: "Sorted order lets pointers move monotonically.", tradeoffs: "Sorting cost; loses original positions." });
    targets.push({ time: "O(n)", space: "O(n)" });
    hints.push("Look for repeated work: what does the inner loop recompute for every outer iteration?", "Could you store something as you go so the inner scan disappears?", "Consider a HashMap, prefix sums, or sorting + two pointers.");
  } else if (sortLeaf && !nested) {
    mainSuggestion = "Selection";
    sug("Heap / Priority Queue", "If only the top-k / min / max is needed, a heap avoids fully sorting: O(n log k) or O(n).");
    addApproach({ name: "Heap / selection (if only top-k is needed)", time: "O(n log k)", space: "O(k)", isCurrent: false, whenToUse: "You only need the k smallest/largest, not full order.", whyItWorks: "Maintain a bounded heap instead of sorting everything.", tradeoffs: "Only applies if a full ordering isn't required." });
    targets.push({ time: "O(n log k)", space: "O(k)" });
    hints.push("Do you need the full order or only part of it?", "What structure keeps the best k items cheaply?", "Think Heap.");
  }

  const timeStr = bigO(time);
  const spaceStr = bigO(space);
  const canImprove = targets.length > 0 && !(kadane || binary);

  // current approach card
  const currentName = recursion ? (recursion.memo ? "Your solution (memoized recursion)" : "Your solution (recursion)") : nested ? "Your solution (nested loops)" : amortized.length ? "Your solution (pointer / window pass)" : loops.length ? "Your solution (single pass)" : "Your solution";
  approaches.unshift({ name: currentName, time: timeStr, space: spaceStr, isCurrent: true, whenToUse: "This is the code you submitted.", whyItWorks: recursion ? recursion.why : nested ? "It examines the required combinations directly." : "It processes the input directly.", tradeoffs: canImprove ? "Simple, but see the alternatives below for lower complexity at a memory or applicability cost." : "Already competitive for this structure." });

  /* ── hotspots ── */
  const hotspots: Analysis["hotspots"] = [];
  if (chain.length) {
    const outer = chain[0], inner = chain[chain.length - 1];
    const parts = chain.map((l) => `line ${l.start + 1} (${l.factor === "n" ? "O(n)" : l.factor === "log" ? "O(log n)" : l.factor === "const" ? "constant" : "amortized O(1) per outer step"})`).join(" → ");
    hotspots.push({
      startLine: outer.start + 1,
      endLine: inner.start + 1,
      cost: bigO(loopCostOf(loops, outer)),
      label: chain.length > 1 ? "Nested loops" : loops.length > 1 && roots.length > 1 ? "Dominant loop" : "Main loop",
      explanation:
        chain.length > 1
          ? `Loop nesting: ${parts}. ${chain.some((l) => l.factor === "amortized") ? `The inner loop is amortized: ${chain.find((l) => l.factor === "amortized")!.note}, so it does not multiply the outer cost.` : "The inner loop's work is repeated for every outer iteration, so the costs multiply."}`
          : `${outer.factor === "log" ? `This loop shrinks or grows its state geometrically (${outer.note}).` : outer.factor === "const" ? "This loop has a constant bound." : "This loop runs once per input element."}`,
      snippet: "",
    });
  }
  for (const lf of LEAVES.filter((x) => x.label === "Sorting" || x.loopId >= 0).slice(0, 3)) {
    if (hotspots.length >= 4) break;
    if (hotspots.some((h) => lf.line + 1 >= h.startLine && lf.line + 1 <= h.endLine && lf.label !== "Sorting")) continue;
    hotspots.push({ startLine: lf.line + 1, endLine: lf.line + 1, cost: bigO(lf.exp), label: lf.label, explanation: lf.note, snippet: "" });
  }
  if (recursion) {
    const first = recursion.callLines[0];
    hotspots.push({ startLine: first + 1, endLine: recursion.callLines[recursion.callLines.length - 1] + 1, cost: bigO(recursion.time), label: `Recursive call${recursion.calls > 1 ? "s" : ""} in ${recursion.method.name}()`, explanation: `${recursion.why} Recurrence: ${recursion.recurrence}.`, snippet: "" });
  }

  /* ── narrative ── */
  const dominantWhy = recursion && cmp(recursion.time, time) === 0
    ? `Recursion dominates: ${recursion.recurrence}.`
    : sortLeaf && cmp(NLOGN, time) === 0
      ? "Sorting dominates the runtime."
      : chain.length > 1
        ? `The loop nesting (${chain.map((l) => (l.factor === "n" ? "n" : l.factor === "log" ? "log n" : l.factor === "const" ? "c" : "amortized")).join(" × ")}) determines the total.`
        : loops.length
          ? "The dominant loop runs once per element (or halves its range)."
          : "No loops or recursion were detected, so the visible work is constant.";

  const spaceExplain = spaceItems.length ? `Dominated by ${spaceItems.reduce((a, b) => (cmp(a.exp, b.exp) >= 0 ? a : b)).label}.` : "No allocation that grows with the input was detected.";

  const confidenceLevel: "high" | "medium" | "low" | "estimated" =
    recursion?.memo || (recursion && recursion.time.kind === "poly" && recursion.calls > 1) ? "estimated"
      : !loops.length && !recursion ? "low"
      : amortized.length || hashy || recursion ? "medium"
      : "medium";

  const edge: { title: string; detail: string }[] = [];
  if (/\[\s*0\s*\]/.test(fullText)) edge.push({ title: "Empty input", detail: "Reads index 0 directly — an empty array/string would throw or return garbage." });
  edge.push({ title: "Single element", detail: "Check that loops with i = 1 or j = i + 1 starts still behave with n = 1." });
  if (/\b(sum|total|prefix|product|count)\b\s*(\+=|\*=)/.test(fullText) && language !== "python") edge.push({ title: "Integer overflow", detail: "Accumulators can exceed 32-bit range on large inputs; consider long." });
  if (hashy || pairSum) edge.push({ title: "Duplicates", detail: "Repeated values interact with maps/sets — check lookup-before-insert ordering." });
  if (rangeAccum || pairSum || kadane) edge.push({ title: "Negative numbers", detail: "Negative values break monotonic assumptions (e.g., sliding windows) and can make sums decrease." });
  if (sortLeaf || binary || sortedHint) edge.push({ title: "Sorted / reverse-sorted input", detail: "Ordering can change best-case behaviour and correctness of order-based logic." });
  if (recursion) edge.push({ title: "Recursion depth", detail: `Depth grows as ${bigO(recursion.stack)}; large inputs can overflow the call stack (Java/Python default limits are low).` });
  if (recursion?.graph) edge.push({ title: "Cycles and disconnected graphs", detail: "Ensure every component is started from and that visited-marking prevents infinite loops." });

  const single = loops.length > 0 && !nested && !recursion;
  const optimalityKind = binary ? "provably_optimal" : canImprove ? "assumption_dependent" : "assumption_dependent";
  const targetTime = canImprove ? targets[0].time : timeStr;
  const targetSpace = canImprove ? targets[0].space : spaceStr;

  const analysis = {
    summary: `Rule-based reading of the code: ${loops.length} loop${loops.length === 1 ? "" : "s"}${recursion ? `, recursion in ${recursion.method.name}()` : ""}${sortLeaf ? ", a sort call" : ""}${hashy ? ", hash-based containers" : ""}. ${dominantWhy}`,
    timeComplexity: {
      value: timeStr,
      explanation: dominantWhy,
      best: "", average: "", worst: timeStr,
    },
    spaceComplexity: {
      value: spaceStr,
      explanation: spaceExplain,
      inputSpace: "O(n)",
      auxiliarySpace: bigO(auxExp),
      stackSpace: bigO(stackExp),
      breakdown: spaceItems.slice(0, 6).map((s) => ({ label: s.label, value: bigO(s.exp), explanation: s.explanation })),
    },
    confidence: {
      level: confidenceLevel,
      reason:
        "Estimated by the built-in rule-based engine (no AI provider configured): it reads loop structure, recursion shape and common container costs, but cannot reason about problem semantics or data-dependent behaviour." +
        (amortized.length ? " Amortized pointer movement was detected heuristically." : "") +
        (hashy ? " Hash operations are assumed O(1) on average." : ""),
    },
    assumptions: [
      "n is the size of the main input (array length / node count)",
      ...(hashy ? ["Hash-based operations are O(1) on average"] : []),
      ...(LEAVES.some((l) => l.label === "Sorting") ? ["Built-in sort is comparison-based O(n log n)"] : []),
      "Library calls not recognised by the engine are treated as O(1)",
    ],
    hotspots,
    patterns,
    optimization: {
      canImprove,
      optimalityKind,
      optimalityNote: canImprove
        ? `The target below is a typical, well-known improvement for this code shape (${mainSuggestion}), not a proven lower bound — it depends on the problem's constraints. Configure an AI provider for a problem-specific optimality argument.`
        : binary
          ? "Comparison-based search in sorted data has an Ω(log n) lower bound, which this loop meets."
          : single
            ? "A single pass is optimal if every input element must be inspected (Ω(n)); that holds for many problems but depends on what is being asked."
            : "No cheaper structure was recognised. That does not prove optimality — problem semantics may allow better.",
      targetTime,
      targetSpace,
      assumptions: canImprove ? ["Problem structure allows storing/reusing earlier results", "Extra memory is acceptable"] : [],
      approaches,
      learningPath: canImprove ? [currentName.replace("Your solution", "Your solution").replace(/\s*\(.*\)/, ""), ...approaches.slice(1).map((a) => a.name)] : [],
      thinkingSteps: canImprove
        ? [
            { title: "Identify repeated work", detail: chain.length > 1 ? `The loop at line ${chain[chain.length - 1].start + 1} runs again for every iteration of the loop at line ${chain[0].start + 1}.` : "Find the computation that is redone for many inputs." },
            { title: "Ask what is being recomputed", detail: "Is it a search, a sum, or a subproblem result? Name it precisely." },
            { title: "Store previously computed information", detail: "A map, prefix array, stack or memo table can hold what you already know." },
            { title: "Replace iteration with a lookup", detail: "Turn the inner scan or repeated call into a constant-time (or logarithmic) access." },
            { title: "Re-derive the complexity", detail: `${timeStr} → ${targetTime}, usually paid for with extra memory (${spaceStr} → ${targetSpace}).` },
          ]
        : [],
      hints: hints.length ? hints : ["Does every element have to be examined at least once?", "Is there any repeated work left?", "What lower bound applies to this problem?"],
      whyFaster: canImprove
        ? "The optimization removes repeated work by remembering earlier results, so each element is handled once. Memory usage typically increases in exchange."
        : "No structural improvement was recognised, so there is nothing to explain.",
    },
    optimizedCode: "",
    codeExplanation: [],
    comparison: {
      optimizedTime: targetTime,
      optimizedSpace: targetSpace,
      tradeoff: canImprove
        ? `Time may improve from ${timeStr} to ${targetTime} at the cost of ${targetSpace === spaceStr ? "no extra" : "additional"} memory (${spaceStr} → ${targetSpace}). Configure an AI provider to generate the concrete optimized code.`
        : "No better structure recognised by the rule-based engine.",
    },
    edgeCases: edge,
  };

  const parsed = AnalysisSchema.parse(analysis);
  return finalizeAnalysis(parsed, code);
}
