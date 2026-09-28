"use client";
import { AlertTriangle, RotateCcw, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

export function ErrorState({
  message,
  canFallback,
  onRetry,
  onFallback,
}: {
  message: string;
  canFallback?: boolean;
  onRetry: () => void;
  onFallback: () => void;
}) {
  return (
    <Card className="border-bad/30 p-6" role="alert">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bad/10 text-bad"><AlertTriangle className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Analysis failed</h2>
          <p className="mt-1 break-words text-sm text-muted">{message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={onRetry}><RotateCcw className="h-3.5 w-3.5" /> Try again</Button>
            {canFallback && (
              <Button variant="secondary" size="sm" onClick={onFallback}><Cpu className="h-3.5 w-3.5" /> Use offline engine instead</Button>
            )}
          </div>
          {canFallback && <p className="mt-3 text-xs text-muted">The offline engine gives a rule-based estimate without calling any AI provider.</p>}
        </div>
      </div>
    </Card>
  );
}
