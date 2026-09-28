import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That page doesn't exist.</p>
      <Link href="/" className="mt-6 inline-block text-sm text-accent hover:underline">Back to the analyzer</Link>
    </div>
  );
}
