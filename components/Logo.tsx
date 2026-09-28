export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="cx-g" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#cx-g)" />
      {/* growth curve that resolves into a flat line: O(n²) → O(n) */}
      <path d="M6 24 C 12 24, 14 22, 17 16 S 22 7, 26 6" stroke="white" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 24 L 26 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="26" cy="12" r="2.4" fill="white" />
    </svg>
  );
}
