import type { Analysis } from "@/lib/schema";

export function SpaceBreakdown({ a }: { a: Analysis }) {
  const rows = a.spaceComplexity.breakdown;
  if (!rows.length) return <p className="text-sm text-muted">{a.spaceComplexity.explanation || "No extra memory beyond a few variables."}</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {rows.map((r, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5">
          <span className="text-sm font-medium">{r.label}</span>
          {r.value && <span className="font-mono text-[13px] text-accent">{r.value}</span>}
          {r.explanation && <span className="basis-full text-[13px] text-muted">{r.explanation}</span>}
        </li>
      ))}
    </ul>
  );
}
