"use client";
import * as React from "react";
import { Cpu, KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { clearSettings, loadSettings, saveSettings } from "@/lib/storage";

interface ServerInfo {
  engine: "ai" | "heuristic";
  provider: string | null;
  model: string | null;
  allowClientKeys: boolean;
  presets: { id: string; label: string; defaultModel: string; free: string }[];
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [info, setInfo] = React.useState<ServerInfo | null>(null);
  const [err, setErr] = React.useState("");
  const [provider, setProvider] = React.useState("openrouter");
  const [model, setModel] = React.useState("");
  const [key, setKey] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setSaved(false);
    const s = loadSettings();
    setProvider(s.provider ?? "openrouter");
    setModel(s.model ?? "");
    setKey(s.apiKey ?? "");
    fetch("/api/analyze")
      .then((r) => r.json())
      .then((j: ServerInfo) => { setInfo(j); setErr(""); })
      .catch(() => setErr("Could not read server configuration."));
  }, [open]);

  const preset = info?.presets.find((p) => p.id === provider);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby="settings-title"
      className="glass m-auto w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="settings-title" className="text-base font-semibold">Settings</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close settings"><X className="h-4 w-4" /></Button>
      </div>

      <div className="space-y-5 px-5 py-5 text-sm">
        <div className="rounded-lg border border-line bg-surface-2 p-3">
          <div className="mb-1 flex items-center gap-2 font-medium"><Cpu className="h-4 w-4 text-accent" /> Server engine</div>
          {err && <p className="text-bad">{err}</p>}
          {!info && !err && <p className="text-muted">Loading…</p>}
          {info && (info.engine === "ai" ? (
            <p className="text-muted">Using <b className="text-fg">{info.provider}</b> · <span className="font-mono text-xs">{info.model}</span> (set by environment variables).</p>
          ) : (
            <p className="text-muted">
              No AI provider is configured on the server, so the <b className="text-fg">offline rule-based engine</b> is used for your own code. Built-in examples are always available. Set <code className="font-mono text-xs">AI_PROVIDER</code> and <code className="font-mono text-xs">AI_API_KEY</code> in <code className="font-mono text-xs">.env.local</code>, or add a key below.
            </p>
          ))}
        </div>

        {info?.allowClientKeys === false ? (
          <p className="text-muted">This deployment disables browser-supplied API keys.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings({ provider, model: model.trim() || undefined, apiKey: key.trim() || undefined });
              setSaved(true);
            }}
          >
            <div className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4 text-accent" /> Use my own key <Badge>optional</Badge></div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Provider</span>
              <select value={provider} onChange={(e) => { setProvider(e.target.value); setSaved(false); }} className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2 text-sm">
                {(info?.presets ?? [{ id: "openrouter", label: "OpenRouter", defaultModel: "", free: "" }]).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              {preset && <span className="mt-1 block text-xs text-muted">{preset.free}</span>}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Model (blank = {preset?.defaultModel || "provider default"})</span>
              <input value={model} onChange={(e) => { setModel(e.target.value); setSaved(false); }} placeholder={preset?.defaultModel} className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 font-mono text-xs" spellCheck={false} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">API key</span>
              <input type="password" value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); }} autoComplete="off" placeholder="sk-…" className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 font-mono text-xs" />
            </label>
            <p className="text-xs text-muted">
              The key stays in this browser's local storage and is sent only to this app's <code className="font-mono">/api/analyze</code> route, which forwards it to the provider. It is never stored on the server.
            </p>
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="sm">Save</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { clearSettings(); setKey(""); setModel(""); setSaved(false); }}>Remove key</Button>
              {saved && <span role="status" className="text-xs text-good">Saved</span>}
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
