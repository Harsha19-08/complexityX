"use client";
import * as React from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CURVES, formatOps, estimateOps, parseComplexity, TONE_HEX, toneOf, type CurveId } from "@/lib/complexity";
import type { Analysis } from "@/lib/schema";

const NS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

export function ComplexityGraph({ a }: { a: Analysis }) {
  const cur = a.timeComplexity.value;
  const opt = a.optimization.canImprove ? a.optimization.targetTime || cur : "";
  const showOpt = !!opt && parseComplexity(opt).id !== parseComplexity(cur).id;
  const [n, setN] = React.useState(1000);

  const data = React.useMemo(
    () => NS.map((x) => {
      const row: Record<string, number> = { n: x, current: Math.log10(estimateOps(cur, x) + 1) };
      if (showOpt) row.optimal = Math.log10(estimateOps(opt, x) + 1);
      return row;
    }),
    [cur, opt, showOpt]
  );
  const curId = parseComplexity(cur).id as CurveId;
  const optId = parseComplexity(opt).id as CurveId;
  const curColor = TONE_HEX[toneOf(cur)];
  const optColor = TONE_HEX[toneOf(opt || cur)];
  const axis = "rgb(var(--muted))";

  return (
    <div>
      <div className="h-56 w-full" role="img" aria-label={`Growth of ${cur}${showOpt ? ` compared with ${opt}` : ""} as input size increases`}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="n" type="number" scale="log" domain={[1, 1024]} ticks={[1, 4, 16, 64, 256, 1024]} stroke={axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgb(var(--line))" }} />
            <YAxis stroke={axis} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v === 0 ? "1" : `10^${v}`)} width={44} />
            <Tooltip
              contentStyle={{ background: "rgb(var(--surface-2))", border: "1px solid rgb(var(--line))", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(l) => `n = ${l}`}
              formatter={(v: number, name) => [formatOps(Math.pow(10, v) - 1), name === "current" ? `Your code ${cur}` : `Optimized ${opt}`]}
            />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "current" ? `Your code ${cur}` : `Optimized ${opt}`)} />
            <Line type="monotone" dataKey="current" stroke={curColor} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            {showOpt && <Line type="monotone" dataKey="optimal" stroke={optColor} strokeWidth={2.5} strokeDasharray="6 4" dot={false} isAnimationActive={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted">Relative growth, log scale. Not benchmarked execution time.</p>

      <div className="mt-4 rounded-lg border border-line bg-surface-2/50 p-3">
        <label className="flex items-center justify-between text-[13px]">
          <span className="text-muted">Operations at n = <span className="font-mono text-fg">{n.toLocaleString("en-US")}</span></span>
        </label>
        <input type="range" min={1} max={6} step={0.1} value={Math.log10(n)} onChange={(e) => setN(Math.round(Math.pow(10, +e.target.value)))} className="mt-2 w-full" aria-label="Input size n" />
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs text-muted">{CURVES[curId].label} now</div><div className="font-mono" style={{ color: curColor }}>{formatOps(estimateOps(cur, n))}</div></div>
          {showOpt && <div><div className="text-xs text-muted">{CURVES[optId].label} optimized</div><div className="font-mono" style={{ color: optColor }}>{formatOps(estimateOps(opt, n))}</div></div>}
        </div>
      </div>
    </div>
  );
}
