"use client";
import * as React from "react";
import { tokenize } from "@/lib/highlight";
import type { Language } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  code: string;
  language: Language;
  /** 1-based line numbers to emphasise */
  highlight?: number[];
  startLine?: number;
  showLineNumbers?: boolean;
  className?: string;
  maxHeight?: number | string;
  label?: string;
}

/** Lightweight, dependency-free static code display (Monaco is reserved for the editable editor). */
export function CodeBlock({ code, language, highlight = [], startLine = 1, showLineNumbers = true, className, maxHeight, label }: Props) {
  const lines = React.useMemo(() => tokenize(code, language), [code, language]);
  const hl = new Set(highlight);
  return (
    <div
      role="region"
      aria-label={label ?? "Code"}
      tabIndex={0}
      style={{ maxHeight }}
      className={cn("overflow-auto rounded-lg border border-line bg-bg/60 py-2 font-mono text-[12.5px] leading-[1.6]", className)}
    >
      <pre className="min-w-max">
        {lines.map((toks, i) => {
          const n = startLine + i;
          const on = hl.has(n);
          return (
            <div key={i} className={cn("flex px-3", on && "bg-hot/10 shadow-[inset_3px_0_0_rgb(var(--hot))]")}>
              {showLineNumbers && <span aria-hidden className="mr-4 w-6 shrink-0 select-none text-right text-muted/60">{n}</span>}
              <code className="whitespace-pre">
                {toks.length ? toks.map((t, k) => <span key={k} className={t.t === "plain" ? undefined : `tok-${t.t}`}>{t.v}</span>) : " "}
              </code>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
