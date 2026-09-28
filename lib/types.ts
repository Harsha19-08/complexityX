export type Language = "java" | "cpp" | "python" | "javascript";

export const LANGUAGES: { id: Language; label: string; monaco: string; file: string }[] = [
  { id: "java", label: "Java", monaco: "java", file: "Solution.java" },
  { id: "cpp", label: "C++", monaco: "cpp", file: "solution.cpp" },
  { id: "python", label: "Python", monaco: "python", file: "solution.py" },
  { id: "javascript", label: "JavaScript", monaco: "javascript", file: "solution.js" },
];

export const languageMeta = (id: Language) => LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];

export type Engine = "ai" | "heuristic" | "curated";

export interface AnalysisMeta {
  engine: Engine;
  provider?: string;
  model?: string;
  generatedAt: number;
}

export type AnalyzeResponse =
  | { ok: true; analysis: import("./schema").Analysis; meta: AnalysisMeta }
  | { ok: false; error: { code: string; message: string; canFallback?: boolean } };

export interface HistoryEntry {
  id: string;
  createdAt: number;
  title: string;
  language: Language;
  code: string;
  analysis: import("./schema").Analysis;
  meta: AnalysisMeta;
}

export interface ClientSettings {
  provider?: string;
  model?: string;
  apiKey?: string;
}
