"use client";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">This page hit an unexpected error</h1>
      <p className="mt-2 text-sm text-muted">{error.message || "Something went wrong."} Your saved history is untouched.</p>
      <Button variant="primary" className="mt-6" onClick={reset}>Reload this page</Button>
    </div>
  );
}
