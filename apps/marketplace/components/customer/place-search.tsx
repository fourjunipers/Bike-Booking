"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { inputClass } from "@/components/form-kit";
import type { Suggestion } from "@/lib/places";
import { MIN_QUERY_LENGTH } from "@/lib/places";

/** Wait this long after the last keystroke before asking for suggestions. */
export const DEBOUNCE_MS = 300;

export type ChosenPlace = { lat: number; lng: number; place: string };

/**
 * Place search with suggestions (city, area, landmark, airport; any country)
 * through our /api/places routes. One session token per search, so Google
 * bills it as one session; a new token after each choice. Calls `onFail`
 * when Places is down or over its limit, so the form can fall back to the
 * station list and "Use my location".
 */
export function PlaceSearch({
  onChoose,
  onFail,
}: {
  onChoose: (p: ChosenPlace) => void;
  onFail: () => void;
}) {
  const t = useTranslations("Search");
  const locale = useLocale();
  const id = useId();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const session = useRef<string | null>(null);
  // True right after a choice, so filling the box doesn't search again.
  const chosen = useRef(false);

  useEffect(() => {
    const q = text.trim();
    if (chosen.current || q.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      session.current ??= crypto.randomUUID();
      setBusy(true);
      try {
        const res = await fetch(
          `/api/places/autocomplete?${new URLSearchParams({ q, session: session.current, lang: locale })}`,
          { signal: abort.signal },
        );
        if (res.status === 429 || res.status >= 500) return onFail();
        if (!res.ok) return;
        const body = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(body.suggestions);
        setActive(-1);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") onFail();
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [text, locale, onFail]);

  async function choose(s: Suggestion) {
    setOpen(false);
    chosen.current = true;
    setText(s.main);
    const token = session.current;
    // The next search is a new billing session.
    session.current = null;
    try {
      const res = await fetch(
        `/api/places/${encodeURIComponent(s.placeId)}${token ? `?session=${token}` : ""}`,
      );
      if (!res.ok) return onFail();
      const { lat, lng } = (await res.json()) as { lat: number; lng: number };
      onChoose({ lat, lng, place: s.main });
    } catch {
      onFail();
    }
  }

  const listId = `${id}-list`;
  const showList = open && text.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="sr-only">
        {t("placeLabel")}
      </label>
      <input
        id={`${id}-input`}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={
          showList && active >= 0 ? `${id}-opt-${active}` : undefined
        }
        autoComplete="off"
        placeholder={t("placePlaceholder")}
        value={text}
        onChange={(e) => {
          chosen.current = false;
          setText(e.target.value);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            // Pick the highlighted place instead of submitting the form.
            e.preventDefault();
            void choose(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={inputClass}
      />
      {showList && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <ul id={listId} role="listbox" aria-label={t("placeLabel")}>
            {suggestions.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                {busy ? t("placeSearching") : t("placeNoMatches")}
              </li>
            )}
            {suggestions.map((s, i) => (
              <li
                key={s.placeId}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void choose(s)}
                className="flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2 hover:bg-mango-soft aria-selected:bg-mango-soft"
              >
                <span className="font-medium">{s.main}</span>
                {s.secondary && (
                  <span className="text-sm text-muted-foreground">
                    {s.secondary}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {/* Google requires its attribution next to Places suggestions. */}
          <p className="border-t px-3 py-1 text-right text-xs text-muted-foreground">
            Google Maps
          </p>
        </div>
      )}
    </div>
  );
}
