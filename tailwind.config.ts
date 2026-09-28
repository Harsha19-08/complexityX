import type { Config } from "tailwindcss";

const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"),
        surface: c("surface"),
        "surface-2": c("surface-2"),
        line: c("line"),
        fg: c("fg"),
        muted: c("muted"),
        accent: c("accent"),
        "accent-2": c("accent-2"),
        good: c("good"),
        warn: c("warn"),
        hot: c("hot"),
        bad: c("bad"),
      },
      fontFamily: {
        sans: ["'Inter Variable'", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono Variable'", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 0 0 rgb(255 255 255 / 0.03) inset, 0 10px 30px -12px rgb(0 0 0 / 0.5)",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
      },
      animation: {
        rise: "rise .35s cubic-bezier(.2,.7,.2,1) both",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
