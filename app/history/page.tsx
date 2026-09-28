"use client";
import * as React from "react";
import Link from "next/link";
import { History, Search, Trash2 } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { deleteHistory, loadHistory } from "@/lib/storage";
import { toneOf } from "@/lib/complexity";
import { formatDate } from "@/lib/utils";
import { LANGUAGES, type HistoryEntry, type Language } from "@/lib/types";

export default function HistoryPage() {
  const [items, setItems] = React.useState<HistoryEntry[] | null>(null);
  const [q, setQ] = React.useState("");
  const [lang, setLang] = React.useState<Language | "all">("all");

  React.useEffect(() => {
    const sync = () => setItems(loadHistory());
    sync();
    window.addEventListener("complexityx:storage", sync);
    return () => window.removeEventListener("complexityx:storage", sync);
  }, []);

  const shown = (items ?? []).filter((e) => (lang === "all" || e.language === lang) && (!q || `${e.title} ${e.analysis.timeComplexity.value} ${e.code}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><History className="h-5 w-5 text-accent" aria-hidden />History</h1>
      <p className="mt-1 text-sm text-muted">Saved in this browser only. Nothing is uploaded.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, complexity or code" aria-label="Search history" className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-accent/60" />
        </div>
        <select value={lang} onChange={(e) => setLang(e.target.value as Language | "all")} aria-label="Filter by language" className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
          <option value="all">All languages</option>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>

      <div className="mt-4 space-y-2.5">
        {items === null ? null : shown.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted">
            {items.length === 0 ? <>No analyses yet. <Link href="/" className="text-accent hover:underline">Analyze some code</Link> and it will show up here.</> : "Nothing matches that filter."}
          </Card>
        ) : shown.map((e) => (
          <Card key={e.id} className="flex flex-wrap items-center gap-3 p-3.5">
            <Link href={`/?h=${e.id}`} className="min-w-0 flex-1 rounded-md">
              <div className="truncate text-sm font-medium">{e.title}</div>
              <div className="mt-0.5 text-xs text-muted">{LANGUAGES.find((l) => l.id === e.language)?.label} · {formatDate(e.createdAt)}</div>
            </Link>
            <Badge tone={toneOf(e.analysis.timeComplexity.value)} className="font-mono">{e.analysis.timeComplexity.value}</Badge>
            <Badge className="font-mono">space {e.analysis.spaceComplexity.value}</Badge>
            <Button variant="ghost" size="icon" aria-label={`Delete ${e.title}`} onClick={() => deleteHistory(e.id)}><Trash2 className="h-4 w-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
