/**
 * The Moto Mangos mark (the marketplace's icon). Decorative: the name is
 * always written beside it.
 */
export function MotoMangosMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="mm-mango" x1="0.2" y1="0.1" x2="0.8" y2="1">
          <stop offset="0" stopColor="#ffd257" />
          <stop offset="0.55" stopColor="#f9a51a" />
          <stop offset="1" stopColor="#ef7d00" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill="#14213d" />
      <g stroke="#ffc94d" strokeWidth="3.6" strokeLinecap="round">
        <path d="M7.5 31h8" />
        <path d="M5.5 38.5h10" />
        <path d="M8.5 46h7" />
      </g>
      <path
        d="M31 19.5C41.5 17 53.5 24.5 53 37.5 52.6 47.5 44.5 54.5 34.5 54 26 53.6 21 49 20.5 43.5 20.2 40.5 21.8 38.6 21 35.6 19.6 30 21.5 21.8 31 19.5z"
        fill="url(#mm-mango)"
      />
      <ellipse
        cx="43"
        cy="31"
        rx="3"
        ry="5.2"
        transform="rotate(-28 43 31)"
        fill="#fff"
        opacity="0.55"
      />
      <path
        d="M31.5 20.5c-.2-2.6-1-4.7-2.6-6.4"
        stroke="#4caf3f"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M31 19c1.4-7.4 8.2-11.3 16.2-9.9-1.5 7.6-8.2 11.4-16.2 9.9z"
        fill="#4caf3f"
      />
      <path
        d="M32.5 18c3.6-2.3 7.6-4.6 12-6.6"
        stroke="#1e5e25"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
