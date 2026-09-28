"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Github, Settings } from "lucide-react";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeProvider";
import { SettingsDialog } from "./SettingsDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Analyzer" },
  { href: "/history", label: "History" },
  { href: "/patterns", label: "Patterns" },
  { href: "/learn", label: "Learn" },
];

export function Navbar() {
  const path = usePathname();
  const [settings, setSettings] = React.useState(false);
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/analyzer") : path.startsWith(href));
  const gh = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com";

  const nav = (extra?: string) => (
    <nav aria-label="Primary" className={cn("flex items-center gap-1", extra)}>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active(l.href) ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active(l.href) ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <header className="glass sticky top-0 z-40 border-b border-line">
      <div className="mx-auto grid h-14 max-w-[1680px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex w-fit items-center gap-2.5 rounded-md" aria-label="ComplexityX home">
          <LogoMark />
          <span className="text-[15px] font-semibold tracking-tight">ComplexityX</span>
        </Link>
        {nav("hidden md:flex")}
        <div className="col-start-3 flex items-center justify-end gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Settings" title="Settings" onClick={() => setSettings(true)}><Settings className="h-4 w-4" /></Button>
          <a href={gh} target="_blank" rel="noreferrer" aria-label="GitHub repository" title="GitHub" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg">
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
      <div className="border-t border-line px-3 py-1.5 md:hidden">{nav("justify-center")}</div>
      <SettingsDialog open={settings} onClose={() => setSettings(false)} />
    </header>
  );
}
