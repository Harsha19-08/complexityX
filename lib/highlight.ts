import type { Language } from "./types";

export type TokType = "kw" | "str" | "com" | "num" | "fn" | "type" | "plain";
export interface Token { t: TokType; v: string }

const KW: Record<Language, string> = {
  java: "abstract assert boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new package private protected public return short static super switch this throw throws try var void volatile while true false null",
  cpp: "auto bool break case catch char class const continue default delete do double else enum explicit extern false float for friend if inline int long namespace new nullptr operator private protected public return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while include define",
  python: "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self",
  javascript: "async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield",
};

const kwSets: Partial<Record<Language, Set<string>>> = {};
const kwSet = (l: Language) => (kwSets[l] ??= new Set(KW[l].split(" ")));

/** Small dependency-free tokenizer. Returns tokens grouped per line. */
export function tokenize(code: string, lang: Language): Token[][] {
  const py = lang === "python";
  const re = new RegExp(
    [
      py ? String.raw`(#.*)` : String.raw`(\/\/.*|\/\*[\s\S]*?(?:\*\/|$))`,
      String.raw`("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?${lang === "javascript" ? "|`(?:\\\\.|[^`\\\\])*`?" : ""})`,
      String.raw`(\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?[LlFfUu]*\b)`,
      String.raw`(#\s*\w+)`,
      String.raw`([A-Za-z_$][\w$]*)`,
    ].join("|"),
    "g"
  );
  const toks: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) toks.push({ t: "plain", v: code.slice(last, m.index) });
    const [full, com, str, num, pre, id] = m;
    if (com) toks.push({ t: "com", v: full });
    else if (str) toks.push({ t: "str", v: full });
    else if (num) toks.push({ t: "num", v: full });
    else if (pre && !py) toks.push({ t: "kw", v: full });
    else if (id) {
      const next = code.slice(re.lastIndex).match(/^\s*\(/);
      if (kwSet(lang).has(id)) toks.push({ t: "kw", v: id });
      else if (next) toks.push({ t: "fn", v: id });
      else if (/^[A-Z][A-Za-z0-9]*$/.test(id) && id.length > 1) toks.push({ t: "type", v: id });
      else toks.push({ t: "plain", v: id });
    } else toks.push({ t: "plain", v: full });
    last = re.lastIndex;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < code.length) toks.push({ t: "plain", v: code.slice(last) });

  // split multi-line tokens into per-line arrays
  const lines: Token[][] = [[]];
  for (const tk of toks) {
    const parts = tk.v.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p) lines[lines.length - 1].push({ t: tk.t, v: p });
    });
  }
  return lines;
}
