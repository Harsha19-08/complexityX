import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: { default: "ComplexityX — Understand your code. See the complexity.", template: "%s · ComplexityX" },
  description: "Paste your DSA solution and turn complexity analysis into a learning experience: time & space complexity, why, patterns, and optimized code.",
};
export const viewport: Viewport = { themeColor: "#080a12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
          <Navbar />
          <main id="main">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
