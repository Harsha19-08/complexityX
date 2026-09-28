"use client";
import * as React from "react";
import { Check, Copy, Eraser, Maximize2, Minimize2, Play, Zap, FileCode2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeEditor, type LineRange } from "./CodeEditor";
import { LANGUAGES, type Language } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  language: Language;
  onLanguage: (l: Language) => void;
  title: string;
  onTitle: (t: string) => void;
  code: string;
  onCode: (c: string) => void;
  onAnalyze: () => void;
  onLoadExample: () => void;
  onClear: () => void;
  loading: boolean;
  ranges: LineRange[];
  validation?: string;
}

const PLACEHOLDER = "// Paste your DSA solution here…";

export function EditorPanel(p: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard unavailable */ }
  };

  const lines = p.code ? p.code.split("\n").length : 0;

  return (
    <>
      {expanded && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setExpanded(false)} aria-hidden />}
      <section
        aria-label="Code editor"
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-soft",
          expanded ? "fixed inset-3 z-50 sm:inset-6" : "h-[520px] lg:sticky lg:top-[4.5rem] lg:h-[calc(100vh-5.75rem)] lg:min-h-[560px]"
        )}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <FileCode2 className="h-4 w-4 text-accent" aria-hidden />
          <h1 className="flex-1 text-[15px] font-semibold tracking-tight">DSA Complexity Analyzer</h1>
          <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy code" title="Copy code" disabled={!p.code}>
            {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={p.onClear} aria-label="Clear editor" title="Clear" disabled={!p.code && !p.title}>
            <Eraser className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? "Exit expanded editor" : "Expand editor"} title={expanded ? "Exit (Esc)" : "Expand editor"}>
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <span role="status" aria-live="polite" className="sr-only">{copied ? "Code copied" : ""}</span>
        </div>

        <div className="grid grid-cols-1 gap-2 border-b border-line px-4 py-3 sm:grid-cols-[auto_1fr]">
          <label className="flex items-center gap-2">
            <span className="sr-only">Language</span>
            <select
              value={p.language}
              onChange={(e) => p.onLanguage(e.target.value as Language)}
              className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-sm font-medium sm:w-36"
              aria-label="Language"
            >
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Problem title (optional)</span>
            <input
              value={p.title}
              onChange={(e) => p.onTitle(e.target.value)}
              maxLength={120}
              placeholder="Optional problem name — e.g. Longest Subarray With Sum K"
              className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm placeholder:text-muted/70"
            />
          </label>
        </div>

        <div className="flex items-center justify-between px-4 pb-1.5 pt-2.5">
          <span className="text-xs font-medium text-muted">Paste your solution</span>
          <span className="font-mono text-[11px] text-muted/80">{lines ? `${lines} lines · ${p.code.length.toLocaleString()} chars` : ""}</span>
        </div>

        <div className="min-h-0 flex-1 border-y border-line">
          <CodeEditor value={p.code} onChange={p.onCode} language={p.language} ranges={p.ranges} onAnalyze={p.onAnalyze} placeholder={PLACEHOLDER} />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <Button variant="primary" size="lg" onClick={p.onAnalyze} disabled={p.loading} className="min-w-[190px]">
            {p.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {p.loading ? "Analyzing…" : "Analyze Complexity"}
          </Button>
          <Button variant="secondary" size="lg" onClick={p.onLoadExample} disabled={p.loading}>
            <Play className="h-3.5 w-3.5" /> Load Example
          </Button>
          <span className="ml-auto hidden text-xs text-muted sm:block">
            <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">Ctrl/⌘</kbd>
            {" + "}
            <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">Enter</kbd>
          </span>
          {p.validation && <p role="alert" className="w-full text-sm text-bad">{p.validation}</p>}
        </div>
      </section>
    </>
  );
}
