"use client";
import { Clock, MemoryStick, ShieldCheck } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { toneOf, TONE_TEXT } from "@/lib/complexity";
import type { Analysis } from "@/lib/schema";
import { cn } from "@/lib/utils";

const CONF: Record<Analysis["confidence"]["level"], { label: string; tone: "good" | "warn" | "hot" | "neutral" }> = {
  high: { label: "High confidence", tone: "good" },
  medium: { label: "Medium confidence", tone: "warn" },
  low: { label: "Low confidence", tone: "hot" },
  estimated: { label: "Estimated", tone: "neutral" },
};

function Stat({ icon, label, value, note, sub }: { icon: React.ReactNode; label: string; value: string; note: string; sub?: React.ReactNode }) {
  const tone = toneOf(value);
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[13px] text-muted">{icon}{label}</div>
      <div className={cn("mt-2 font-mono text-3xl font-semibold tracking-tight", TONE_TEXT[tone])}>{value}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{note}</p>
      {sub}
    </Card>
  );
}

export function ComplexityCards({ a }: { a: Analysis }) {
  const c = CONF[a.confidence.level];
  const t = a.timeComplexity;
  const s = a.spaceComplexity;
  const cases = [["Best", t.best], ["Average", t.average], ["Worst", t.worst]].filter(([, v]) => v);
  return (
    <div className="space-y-3">
      {a.summary && <p className="text-[15px] leading-relaxed text-fg/90">{a.summary}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Time complexity"
          value={t.value}
          note={t.explanation}
          sub={cases.length > 0 && (
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs">
              {cases.map(([k, v]) => (<div key={k} className="flex gap-1.5"><dt className="text-muted">{k}</dt><dd className="font-mono">{v}</dd></div>))}
            </dl>
          )}
        />
        <Stat
          icon={<MemoryStick className="h-3.5 w-3.5" />}
          label="Space complexity"
          value={s.value}
          note={s.explanation}
          sub={(s.inputSpace || s.auxiliarySpace || s.stackSpace) && (
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs">
              {s.auxiliarySpace && <div className="flex gap-1.5"><dt className="text-muted">Auxiliary</dt><dd className="font-mono">{s.auxiliarySpace}</dd></div>}
              {s.stackSpace && <div className="flex gap-1.5"><dt className="text-muted">Stack</dt><dd className="font-mono">{s.stackSpace}</dd></div>}
              {s.inputSpace && <div className="flex gap-1.5"><dt className="text-muted">Input</dt><dd className="font-mono">{s.inputSpace}</dd></div>}
            </dl>
          )}
        />
      </div>
      <Card className="flex flex-wrap items-start gap-x-3 gap-y-2 p-3">
        <Badge tone={c.tone}><ShieldCheck className="h-3 w-3" />{c.label}</Badge>
        <p className="min-w-0 flex-1 text-[13px] text-muted">{a.confidence.reason || "Derived from static reading of the code."}</p>
        {a.assumptions.length > 0 && (
          <ul className="basis-full list-disc space-y-0.5 pl-5 text-[13px] text-muted">
            {a.assumptions.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
