"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_BG, type Tone } from "@/lib/complexity";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-soft", className)} {...props} />;
}

export function Badge({ className, tone, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone | "accent" | "neutral" }) {
  const cls =
    tone === "accent"
      ? "border-accent/30 bg-accent/10 text-accent"
      : tone && tone !== "neutral"
        ? TONE_BG[tone]
        : "border-line bg-surface-2 text-muted";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none", cls, className)} {...props}>
      {children}
    </span>
  );
}

/** Complexity pill, monospaced. */
export function Mono({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("font-mono", className)} {...props} />;
}

interface SectionProps {
  id?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Collapsible result section. The header is a real button with aria-expanded. */
export function Section({ id, title, subtitle, icon, defaultOpen = true, right, children, className }: SectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const panelId = React.useId();
  return (
    <section id={id} className={cn("rounded-xl border border-line bg-surface shadow-soft scroll-mt-20", className)}>
      <div className="flex items-center gap-2 pr-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left"
        >
          {icon && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-accent">{icon}</span>}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold tracking-tight">{title}</span>
            {subtitle && <span className="mt-0.5 block text-xs text-muted">{subtitle}</span>}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open ? "rotate-180" : "")} aria-hidden />
        </button>
        {right}
      </div>
      <div id={panelId} hidden={!open} className="border-t border-line px-4 pb-4 pt-4">
        {children}
      </div>
    </section>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-line bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-[13px] font-medium transition-colors",
            value === o.value ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
