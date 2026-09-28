"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import type { OnMount, BeforeMount } from "@monaco-editor/react";
import { languageMeta, type Language } from "@/lib/types";
import { useTheme } from "./ThemeProvider";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted" role="status">Loading editor…</div>
  ),
});

export interface LineRange { start: number; end: number }

interface Props {
  value: string;
  onChange: (v: string) => void;
  language: Language;
  ranges?: LineRange[];
  onAnalyze: () => void;
  placeholder?: string;
}

const beforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("cx-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b7699", fontStyle: "italic" },
      { token: "keyword", foreground: "c4b5fd" },
      { token: "string", foreground: "86efac" },
      { token: "number", foreground: "fdba74" },
      { token: "type", foreground: "67e8f9" },
      { token: "type.identifier", foreground: "67e8f9" },
    ],
    colors: {
      "editor.background": "#0e111c",
      "editor.lineHighlightBackground": "#141830",
      "editorLineNumber.foreground": "#3d4668",
      "editorLineNumber.activeForeground": "#9aa4c7",
      "editorCursor.foreground": "#818cf8",
      "editor.selectionBackground": "#3b427a99",
      "editorIndentGuide.background1": "#1a2038",
      "editorIndentGuide.activeBackground1": "#2b3358",
      "editorWidget.background": "#141830",
      "scrollbarSlider.background": "#2a325566",
    },
  });
  monaco.editor.defineTheme("cx-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8b93ad", fontStyle: "italic" },
      { token: "keyword", foreground: "7c3aed" },
      { token: "string", foreground: "15803d" },
      { token: "number", foreground: "c2410c" },
    ],
    colors: { "editor.background": "#ffffff", "editor.lineHighlightBackground": "#f3f4fb", "editorLineNumber.foreground": "#b3b9d1" },
  });
};

export function CodeEditor({ value, onChange, language, ranges = [], onAnalyze, placeholder }: Props) {
  const { theme } = useTheme();
  const editorRef = React.useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = React.useRef<Parameters<OnMount>[1] | null>(null);
  const decoRef = React.useRef<{ clear: () => void } | null>(null);
  const analyzeRef = React.useRef(onAnalyze);
  const [ready, setReady] = React.useState(false);
  analyzeRef.current = onAnalyze;

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => analyzeRef.current());
    setReady(true);
  };

  // Highlight complexity hotspots directly in the editor.
  React.useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ready || !ed || !monaco) return;
    decoRef.current?.clear();
    const lineCount = ed.getModel()?.getLineCount() ?? 0;
    const valid = ranges.filter((r) => r.start >= 1 && r.start <= lineCount);
    decoRef.current = ed.createDecorationsCollection(
      valid.map((r) => ({
        range: new monaco.Range(r.start, 1, Math.min(r.end, lineCount), 1),
        options: { isWholeLine: true, className: "cx-hotspot-line", linesDecorationsClassName: "cx-hotspot-bar" },
      }))
    );
    if (valid.length) ed.revealLineInCenterIfOutsideViewport(valid[0].start);
  }, [ranges, ready]);

  return (
    <div className="relative h-full w-full" data-testid="code-editor">
      {!value && placeholder && (
        <pre aria-hidden className="pointer-events-none absolute left-[62px] top-3 z-10 font-mono text-[13px] leading-[21px] text-muted/50">{placeholder}</pre>
      )}
      <Monaco
        height="100%"
        language={languageMeta(language).monaco}
        value={value}
        theme={theme === "dark" ? "cx-dark" : "cx-light"}
        beforeMount={beforeMount}
        onMount={handleMount}
        onChange={(v) => onChange(v ?? "")}
        options={{
          fontFamily: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13.5,
          lineHeight: 21,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
          lineNumbersMinChars: 3,
          tabSize: 4,
          insertSpaces: true,
          automaticLayout: true,
          renderLineHighlight: "line",
          smoothScrolling: true,
          cursorSmoothCaretAnimation: "on",
          bracketPairColorization: { enabled: true },
          guides: { indentation: true },
          wordWrap: "off",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          renderWhitespace: "none",
          folding: true,
          contextmenu: true,
          ariaLabel: "Code editor. Paste your solution here. Press Control or Command plus Enter to analyze.",
          accessibilitySupport: "auto",
        }}
      />
    </div>
  );
}
