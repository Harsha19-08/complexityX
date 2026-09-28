import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Learn" };

const ROWS: [string, string, string, string][] = [
  ["O(1)", "Array index, hash lookup", "1", "Constant"],
  ["O(log n)", "Binary search", "10", "Halving each step"],
  ["O(n)", "Single loop", "1,000", "Touch each item once"],
  ["O(n log n)", "Merge sort, sort then scan", "10,000", "Divide, then linear merge"],
  ["O(n²)", "Nested loops over the input", "1,000,000", "Every pair"],
  ["O(2ⁿ)", "Naive Fibonacci, subsets", "≈ 10³⁰⁰", "Doubling per element"],
];

const STEPS: [string, string][] = [
  ["Find the loops", "Ask what each loop's bound depends on. A loop from i to n inside a loop over n is n². A loop whose pointer never resets is usually amortized."],
  ["Price the calls", "A call inside a loop costs its own complexity. contains on a list, string concatenation and slicing are all linear."],
  ["Solve the recursion", "Write T(n) in terms of smaller calls. Two calls on n − 1 is 2ⁿ. Two calls on n/2 plus a linear merge is n log n."],
  ["Count memory", "Separate auxiliary space from the input, and do not forget the recursion stack."],
  ["Look for what the inner loop repeats", "If it searches or sums something the outer loop could remember, a HashMap or prefix sum can remove it."],
];

export default function LearnPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Learn to read complexity</h1>
      <p className="mt-1 text-sm text-muted">A five-step routine you can run on any solution, and a cheat sheet for what the answers mean.</p>

      <ol className="mt-6 space-y-3">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/40 font-mono text-xs text-accent">{i + 1}</span>
            <div><div className="text-sm font-medium">{t}</div><p className="text-[13px] leading-relaxed text-muted">{d}</p></div>
          </li>
        ))}
      </ol>

      <Card className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Common complexities</caption>
          <thead className="border-b border-line text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Class</th><th className="px-4 py-2 font-medium">Typical example</th><th className="px-4 py-2 font-medium">Ops at n = 1,000</th><th className="px-4 py-2 font-medium">Feels like</th></tr></thead>
          <tbody className="divide-y divide-line">
            {ROWS.map((r) => (<tr key={r[0]}><td className="px-4 py-2 font-mono text-accent">{r[0]}</td><td className="px-4 py-2">{r[1]}</td><td className="px-4 py-2 font-mono">{r[2]}</td><td className="px-4 py-2 text-muted">{r[3]}</td></tr>))}
          </tbody>
        </table>
      </Card>

      <p className="mt-6 text-sm text-muted">Turn on Learning mode in the analyzer to get hints before the answer, or browse the <Link href="/patterns" className="text-accent hover:underline">pattern library</Link>.</p>
    </div>
  );
}
