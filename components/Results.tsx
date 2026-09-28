"use client";
import * as React from "react";
import { AlertTriangle, BarChart3, BookOpen, CheckCircle2, Cpu, Flame, GitCompare, Layers, ListChecks, Rocket, Sparkles, TrendingUp, Wand2 } from "lucide-react";
import { Badge, Section, Segmented } from "@/components/ui/primitives";
import { ComplexityCards } from "./results/ComplexityCards";
import { ComplexityGraph } from "./results/ComplexityGraph";
import { Hotspots } from "./results/Hotspots";
import { SpaceBreakdown } from "./results/SpaceBreakdown";
import { Approaches, Comparison, EdgeCases, Hints, OptimalityBanner, OptimizedCode, Patterns, RevealGate, ThinkingSteps } from "./results/Optimization";
import type { Analysis } from "@/lib/schema";
import type { AnalysisMeta, Language } from "@/lib/types";

export type Mode = "analysis" | "learning";

const ENGINE: Record<AnalysisMeta["engine"], string> = { ai: "AI analysis", heuristic: "Offline rule-based engine", curated: "Reviewed example" };

export function Results({
  analysis: a, meta, code, language, mode, onMode, activeHotspot, onActiveHotspot,
}: {
  analysis: Analysis; meta: AnalysisMeta; code: string; language: Language; mode: Mode; onMode: (m: Mode) => void;
  activeHotspot: number | null; onActiveHotspot: (i: number | null) => void;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const [hintCount, setHintCount] = React.useState(0);

  // A new analysis starts a fresh learning session.
  React.useEffect(() => { setRevealed(false); setHintCount(0); }, [a]);

  const learning = mode === "learning" && a.optimization.canImprove;
  const show = !learning || revealed;
  const o = a.optimization;
  const visiblePatterns = show ? a : { ...a, patterns: a.patterns.filter((p) => p.status === "detected") };

  return (
    <div className="space-y-3 animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={meta.engine === "heuristic" ? "warn" : "accent"}><Cpu className="h-3 w-3" />{ENGINE[meta.engine]}</Badge>
          {meta.model && <Badge className="font-mono">{meta.model}</Badge>}
        </div>
        <Segmented<Mode> label="Mode" value={mode} onChange={onMode} options={[{ value: "analysis", label: "Analysis" }, { value: "learning", label: "Learning" }]} />
      </div>

      {meta.engine === "heuristic" && (
        <div className="flex gap-2 rounded-lg border border-warn/30 bg-warn/5 p-3 text-[13px] text-muted" role="note">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
          <p>This is a static, rule-based estimate. Unusual control flow can fool it. Add an AI provider in Settings for deeper analysis and optimized code.</p>
        </div>
      )}

      <ComplexityCards a={a} />

      <Section id="growth" title="Complexity growth" icon={<TrendingUp className="h-4 w-4" />} subtitle="How work scales with input size">
        <ComplexityGraph a={a} />
      </Section>

      <Section id="hotspots" title="Code hotspots" icon={<Flame className="h-4 w-4" />} subtitle="Where the time goes">
        <Hotspots a={a} code={code} language={language} active={activeHotspot} onActive={onActiveHotspot} />
      </Section>

      <Section id="space" title="Space breakdown" icon={<BarChart3 className="h-4 w-4" />} defaultOpen={false}>
        <SpaceBreakdown a={a} />
      </Section>

      <Section id="patterns" title="DSA patterns" icon={<Layers className="h-4 w-4" />}>
        <Patterns a={visiblePatterns} />
        {!show && a.patterns.some((p) => p.status === "suggested") && <p className="mt-2 text-xs text-muted">Suggested patterns are hidden in Learning mode until you reveal the solution.</p>}
      </Section>

      <Section id="optimize" title="Optimization" icon={<Rocket className="h-4 w-4" />} subtitle={o.canImprove ? `Target ${o.targetTime}` : "Already at the best known bound"}>
        {learning && !revealed ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted">Learning mode: your code can be improved. Work through the hints, then reveal.</p>
            {o.hints.length > 0 ? <Hints hints={o.hints} revealed={hintCount} onReveal={() => setHintCount((c) => c + 1)} /> : <p className="text-sm text-muted">No hints available for this analysis.</p>}
            <RevealGate onReveal={() => setRevealed(true)} />
          </div>
        ) : (
          <div className="space-y-4">
            <OptimalityBanner a={a} />
            <Approaches a={a} />
            {o.thinkingSteps.length > 0 && (<div><h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium"><ListChecks className="h-4 w-4 text-accent" />How to get there</h3><ThinkingSteps a={a} /></div>)}
            {mode === "analysis" && o.hints.length > 0 && (
              <div><h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium"><BookOpen className="h-4 w-4 text-accent" />Hints</h3><Hints hints={o.hints} revealed={o.hints.length} onReveal={() => {}} /></div>
            )}
          </div>
        )}
      </Section>

      {show && o.canImprove && (
        <>
          <Section id="code" title="Optimized solution" icon={<Wand2 className="h-4 w-4" />}>
            <OptimizedCode a={a} language={language} />
          </Section>
          <Section id="compare" title="Before and after" icon={<GitCompare className="h-4 w-4" />}>
            <Comparison a={a} />
          </Section>
        </>
      )}
      {show && !o.canImprove && (
        <div className="flex items-center gap-2 rounded-lg border border-good/30 bg-good/5 p-3 text-[13px]"><CheckCircle2 className="h-4 w-4 text-good" aria-hidden /><span>No asymptotic improvement to suggest.</span></div>
      )}

      <Section id="edge" title="Edge cases" icon={<Sparkles className="h-4 w-4" />} defaultOpen={false}>
        <EdgeCases a={a} />
      </Section>
    </div>
  );
}
