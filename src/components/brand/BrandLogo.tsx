/**
 * Brand logo icon component (inline SVG).
 *
 * Renders the HRSign brand mark — a blue rounded square containing a white
 * document, a signature pen stroke, and a seal checkmark. Scales crisply at
 * any size because it is vector-based.
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
      <rect width="256" height="256" rx="56" fill="#2563EB" />
      <path d="M88 52 L168 52 L192 76 L192 204 L88 204 Z" fill="#FFFFFF" />
      <path d="M168 52 L168 76 L192 76 Z" fill="#DBEAFE" />
      <path
        d="M104 168 C108 148 124 142 136 154 C148 166 160 142 172 120"
        stroke="#2563EB"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <circle cx="148" cy="186" r="14" fill="none" stroke="#2563EB" strokeWidth="5" />
      <path
        d="M141 186 L146 191 L155 182"
        stroke="#2563EB"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
