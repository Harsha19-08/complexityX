"use client";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { EXAMPLE_BUTTONS } from "@/lib/samples";

const ITEMS = [
  "Time complexity",
  "Space complexity",
  "Complexity growth",
  "Code hotspots",
  "DSA patterns",
  "Optimization opportunities",
  "Alternative approaches",
  "Optimized implementation",
];

export function EmptyState({ onExample }: { onExample: (id: string) => void }) {
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">Paste your DSA solution</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted">Understand your code. See the complexity. Discover the optimal approach.</p>
      <p className="mt-6 text-sm font-medium">ComplexityX will analyze:</p>
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {ITEMS.map((t) => (
          <li key={t} className="flex items-center gap-2 text-sm text-muted">
            <Check className="h-4 w-4 shrink-0 text-good" aria-hidden /> {t}
          </li>
        ))}
      </ul>
      <div className="mt-7 border-t border-line pt-5">
        <p className="mb-3 text-xs text-muted">Or try a built-in example:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_BUTTONS.map((e) => (
            <Button key={e.id} variant="secondary" size="sm" onClick={() => onExample(e.id)}>
              <Sparkles className="h-3.5 w-3.5 text-accent" /> {e.buttonLabel}
            </Button>
          ))}
        </div>
      </div>
      <p className="mt-6 text-xs leading-relaxed text-muted">
        Analysis is static and theoretical — nothing is executed or benchmarked. Complexity is derived from the structure of your code.
      </p>
    </Card>
  );
}
