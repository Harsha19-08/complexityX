"use client";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { CodeBlock } from "@/components/CodeBlock";
import { toneOf } from "@/lib/complexity";
import type { Analysis } from "@/lib/schema";
import type { Language } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Hotspots({ a, code, language, active, onActive }: { a: Analysis; code: string; language: Language; active: number | null; onActive: (i: number | null) => void }) {
  if (!a.hotspots.length) return <p className="text-sm text-muted">No single line dominates the cost.</p>;
  const lines = code.split("\n");
  return (
    <ol className="space-y-3">
      {a.hotspots.map((h, i) => {
        const hasLines = h.startLine > 0;
        const snippet = hasLines ? lines.slice(h.startLine - 1, h.endLine).join("\n") : h.snippet;
        const on = active === i;
        return (
          <li key={i} className={cn("rounded-lg border bg-surface-2/40 p-3 transition-colors", on ? "border-accent/50" : "border-line")}>
            <div className="flex flex-wrap items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-hot" aria-hidden />
              <span className="text-sm font-medium">{h.label || `Hotspot ${i + 1}`}</span>
              {h.cost && <Badge tone={toneOf(h.cost)} className="font-mono">{h.cost}</Badge>}
              {hasLines && (
                <button type="button" onClick={() => onActive(on ? null : i)} aria-pressed={on} className="ml-auto text-xs text-accent hover:underline">
                  {on ? "Hide in editor" : `Lines ${h.startLine}${h.endLine > h.startLine ? `–${h.endLine}` : ""}: show in editor`}
                </button>
              )}
            </div>
            {h.explanation && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{h.explanation}</p>}
            {snippet && <CodeBlock code={snippet} language={language} startLine={hasLines ? h.startLine : 1} showLineNumbers={hasLines} className="mt-2" maxHeight={180} label={`Hotspot ${i + 1} code`} />}
          </li>
        );
      })}
    </ol>
  );
}
