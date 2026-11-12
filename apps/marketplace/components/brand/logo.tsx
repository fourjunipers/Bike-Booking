/**
 * Small decorative brand accents. The logo itself is public/logo.png (top
 * bar); the favicon is app/icon.svg.
 */

/** Three speed lines: a small decorative accent beside headings. */
export function SpeedLines({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 16"
      aria-hidden
      className={className}
      fill="none"
      strokeLinecap="round"
      strokeWidth="3"
    >
      <path d="M10 3h16" stroke="var(--mango)" />
      <path d="M2 8h20" stroke="var(--sun)" />
      <path d="M8 13h14" stroke="var(--mango)" />
    </svg>
  );
}

/** A small leaf: decorative accent. */
export function Leaf({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M3 20C4 9 11 3 22 3c0 11-7 18-19 17z"
        fill="var(--leaf-bright)"
      />
      <path
        d="M5 18c4-4 8-8 13-12"
        stroke="var(--leaf-ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
