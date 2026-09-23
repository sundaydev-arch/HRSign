/**
 * Brand logo icon component (inline SVG).
 *
 * Ink-black mark with a paper sheet, vermilion signature stroke, and seal.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="HRSign"
    >
      <rect width="256" height="256" rx="60" fill="#1C1917" />
      <path d="M86 50 L166 50 L196 80 L196 206 L86 206 Z" fill="#FAF7F2" />
      <path d="M166 50 L166 80 L196 80 Z" fill="#E8E0D4" />
      <path
        d="M104 168 C110 146 126 140 138 154 C150 168 162 140 176 118"
        stroke="#9A5346"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <circle cx="150" cy="188" r="15" fill="none" stroke="#9A5346" strokeWidth="5" />
      <path
        d="M143 188 L148 193 L158 183"
        stroke="#9A5346"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
