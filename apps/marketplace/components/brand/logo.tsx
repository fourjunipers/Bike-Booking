import { useId } from "react";

/**
 * The Moto Mangos mango badge: a mango with a leaf and speed lines on a navy
 * disc. The same drawing as app/icon.svg (the favicon); keep them in step.
 */
export function MangoIcon({
  className,
  title,
}: {
  className?: string;
  /** Leave out when the icon sits next to its own text. */
  title?: string;
}) {
  const gradient = `mango-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradient} x1="0.2" y1="0.1" x2="0.8" y2="1">
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
        fill={`url(#${gradient})`}
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

/** Icon and wordmark for the navy header: "Moto" in white, "Mangos" in mango. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <MangoIcon className="size-9 shrink-0" />
      <span className="font-heading text-xl font-black tracking-tight italic">
        <span className="text-white">Moto</span>
        <span className="text-mango">Mangos</span>
      </span>
    </span>
  );
}

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
