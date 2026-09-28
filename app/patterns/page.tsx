import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { PATTERNS } from "@/lib/patterns";

export const metadata: Metadata = { title: "Patterns" };

export default function PatternsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">DSA patterns</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">The handful of ideas behind most complexity improvements. Each page has the clues to spot it, a template and the traps.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PATTERNS.map((p) => (
          <Link key={p.slug} href={`/patterns/${p.slug}`} className="group rounded-xl">
            <Card className="h-full p-4 transition-colors group-hover:border-accent/50">
              <h2 className="text-[15px] font-semibold">{p.name}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{p.tagline}</p>
              <p className="mt-3 font-mono text-xs text-accent">{p.time}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
