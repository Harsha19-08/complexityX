"use client";
import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const STAGES = [
  "Parsing code…",
  "Detecting loops…",
  "Analyzing recursion…",
  "Identifying data structures…",
  "Deriving complexity…",
  "Finding optimization patterns…",
];

export function LoadingAnalysis() {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, STAGES.length - 1)), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <Card className="p-5" aria-busy="true">
      <div role="status" aria-live="polite" className="sr-only">{STAGES[i]}</div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-full animate-shimmer shimmer rounded-full" />
      </div>
      <ul className="mt-5 space-y-2.5" aria-hidden>
        {STAGES.map((s, k) => (
          <li key={s} className={cn("flex items-center gap-2.5 text-sm transition-opacity", k > i ? "opacity-30" : "opacity-100", k === i ? "text-fg" : "text-muted")}>
            {k < i ? <Check className="h-4 w-4 text-good" /> : k === i ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <span className="h-4 w-4 rounded-full border border-line" />}
            {s}
          </li>
        ))}
      </ul>
      <div className="mt-6 grid grid-cols-2 gap-3" aria-hidden>
        {[0, 1].map((k) => <div key={k} className="h-28 rounded-lg border border-line bg-surface-2/60" />)}
      </div>
    </Card>
  );
}
