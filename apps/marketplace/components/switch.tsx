"use client";

/**
 * An on/off toggle switch. Underneath it is a checkbox with role="switch", so
 * it keeps keyboard, label and screen-reader behaviour for free.
 */
export function Switch({
  checked,
  onChange,
  label,
  ariaLabel,
  name,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible text next to the switch, if any (then give ariaLabel). */
  label?: React.ReactNode;
  /** Accessible name when the visible text alone isn't enough. */
  ariaLabel?: string;
  name?: string;
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        role="switch"
        name={name}
        checked={checked}
        aria-checked={checked}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-slate-300 transition-colors peer-checked:bg-leaf peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring after:absolute after:left-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
      />
      {label && <span className="font-medium">{label}</span>}
    </label>
  );
}
