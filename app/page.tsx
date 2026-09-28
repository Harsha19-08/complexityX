"use client";
import * as React from "react";
import { EditorPanel } from "@/components/EditorPanel";
import { EmptyState } from "@/components/EmptyState";
import { LoadingAnalysis } from "@/components/LoadingAnalysis";
import { ErrorState } from "@/components/ErrorState";
import { Results, type Mode } from "@/components/Results";
import { addHistory, getHistoryEntry, loadMode, loadSettings, saveMode } from "@/lib/storage";
import { DEFAULT_EXAMPLE, SAMPLES } from "@/lib/samples";
import { uid } from "@/lib/utils";
import type { Analysis } from "@/lib/schema";
import type { AnalysisMeta, AnalyzeResponse, Language } from "@/lib/types";

interface Done { analysis: Analysis; meta: AnalysisMeta; code: string; language: Language }
type Phase = { s: "idle" } | { s: "loading" } | { s: "error"; message: string; canFallback?: boolean } | ({ s: "done" } & Done);

export default function HomePage() {
  const [language, setLanguage] = React.useState<Language>(DEFAULT_EXAMPLE.language);
  const [title, setTitle] = React.useState("");
  const [code, setCode] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>({ s: "idle" });
  const [mode, setMode] = React.useState<Mode>("analysis");
  const [validation, setValidation] = React.useState<string>();
  const [active, setActive] = React.useState<number | null>(null);
  const reqId = React.useRef(0);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMode(loadMode());
    const id = new URLSearchParams(window.location.search).get("h");
    if (id) {
      const e = getHistoryEntry(id);
      if (e) {
        setLanguage(e.language); setTitle(e.title); setCode(e.code);
        setPhase({ s: "done", analysis: e.analysis, meta: e.meta, code: e.code, language: e.language });
      }
    }
  }, []);

  const changeMode = (m: Mode) => { setMode(m); saveMode(m); };

  const analyze = React.useCallback(async (input?: { code: string; language: Language; title: string }, engine?: "heuristic") => {
    const c = input?.code ?? code, lang = input?.language ?? language, t = input?.title ?? title;
    if (c.trim().length < 8) { setValidation("Paste some code to analyze."); return; }
    setValidation(undefined); setActive(null);
    const id = ++reqId.current;
    setPhase({ s: "loading" });
    const s = loadSettings();
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (s.apiKey) { headers["x-cx-key"] = s.apiKey; if (s.provider) headers["x-cx-provider"] = s.provider; if (s.model) headers["x-cx-model"] = s.model; }
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers, body: JSON.stringify({ language: lang, problemTitle: t, code: c, engine }) });
      const data = (await res.json()) as AnalyzeResponse;
      if (id !== reqId.current) return;
      if (!data.ok) { setPhase({ s: "error", message: data.error.message, canFallback: data.error.canFallback }); return; }
      setPhase({ s: "done", analysis: data.analysis, meta: data.meta, code: c, language: lang });
      addHistory({ id: uid(), createdAt: Date.now(), title: t || "Untitled", language: lang, code: c, analysis: data.analysis, meta: data.meta });
      if (window.matchMedia("(max-width: 1023px)").matches) setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch {
      if (id !== reqId.current) return;
      setPhase({ s: "error", message: "Could not reach the analysis service. Check your connection and try again.", canFallback: true });
    }
  }, [code, language, title]);

  const loadExample = () => { setLanguage(DEFAULT_EXAMPLE.language); setTitle(DEFAULT_EXAMPLE.title); setCode(DEFAULT_EXAMPLE.code); setValidation(undefined); };
  const pickExample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id); if (!s) return;
    setLanguage(s.language); setTitle(s.title); setCode(s.code);
    void analyze({ code: s.code, language: s.language, title: s.title });
  };
  const clear = () => { setCode(""); setTitle(""); setPhase({ s: "idle" }); setActive(null); setValidation(undefined); };

  const done = phase.s === "done" ? phase : null;
  const inSync = !!done && done.code === code;
  const ranges = React.useMemo(() => {
    if (!done || !inSync) return [];
    const hs = done.analysis.hotspots.map((h, i) => ({ h, i })).filter(({ h }) => h.startLine > 0);
    return (active == null ? hs : hs.filter(({ i }) => i === active)).map(({ h }) => ({ start: h.startLine, end: h.endLine }));
  }, [done, inSync, active]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      <div className="grid items-start gap-5 lg:grid-cols-[55fr_45fr]">
        <div className="lg:sticky lg:top-20">
          <EditorPanel
            language={language} onLanguage={setLanguage} title={title} onTitle={setTitle} code={code} onCode={(c) => { setCode(c); setValidation(undefined); }}
            onAnalyze={() => analyze()} onLoadExample={loadExample} onClear={clear} loading={phase.s === "loading"} ranges={ranges} validation={validation}
          />
        </div>
        <div ref={resultsRef} className="min-w-0 scroll-mt-20" aria-live="polite">
          {phase.s === "idle" && <EmptyState onExample={pickExample} />}
          {phase.s === "loading" && <LoadingAnalysis />}
          {phase.s === "error" && <ErrorState message={phase.message} canFallback={phase.canFallback} onRetry={() => analyze()} onFallback={() => analyze(undefined, "heuristic")} />}
          {done && (
            <>
              {!inSync && <p className="mb-3 rounded-lg border border-line bg-surface-2/50 p-2.5 text-xs text-muted">The editor changed since this analysis. Press Analyze to refresh it.</p>}
              <Results analysis={done.analysis} meta={done.meta} code={done.code} language={done.language} mode={mode} onMode={changeMode} activeHotspot={active} onActiveHotspot={setActive} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
