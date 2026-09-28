import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CodeBlock } from "@/components/CodeBlock";
import { Badge } from "@/components/ui/primitives";
import { PATTERNS, getPattern } from "@/lib/patterns";

export const dynamicParams = false;
export const generateStaticParams = () => PATTERNS.map((p) => ({ slug: p.slug }));
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return { title: getPattern(params.slug)?.name ?? "Pattern" };
}

const List = ({ title, items }: { title: string; items: string[] }) => (
  <section className="mt-6">
    <h2 className="text-sm font-semibold">{title}</h2>
    <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-muted">{items.map((x) => <li key={x}>{x}</li>)}</ul>
  </section>
);

export default function PatternPage({ params }: { params: { slug: string } }) {
  const p = getPattern(params.slug);
  if (!p) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/patterns" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ChevronLeft className="h-4 w-4" />All patterns</Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{p.name}</h1>
      <p className="mt-1 text-muted">{p.tagline}</p>
      <div className="mt-3 flex gap-2"><Badge tone="good" className="font-mono">time {p.time}</Badge><Badge className="font-mono">space {p.space}</Badge></div>
      <section className="mt-6"><h2 className="text-sm font-semibold">What it is</h2><p className="mt-2 text-[14px] leading-relaxed text-muted">{p.what}</p></section>
      <List title="When to reach for it" items={p.recognize} />
      <List title="Clues in the problem" items={p.clues} />
      <section className="mt-6"><h2 className="mb-2 text-sm font-semibold">Template</h2><CodeBlock code={p.template} language="python" label={`${p.name} template`} /></section>
      <List title="Practice problems" items={p.examples} />
      <List title="Common mistakes" items={p.mistakes} />
    </div>
  );
}
