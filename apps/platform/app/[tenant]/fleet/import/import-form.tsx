"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { startTransition, useActionState } from "react";
import { Field, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { importFleet, type ImportState } from "../actions";

/** Upload or paste a CSV; shows every problem by line and column, or what was imported. */
export function ImportForm({
  slug,
  fleetHref,
}: {
  slug: string;
  fleetHref: string;
}) {
  const t = useTranslations("Fleet.import");
  const [state, action, pending] = useActionState<ImportState, FormData>(
    importFleet,
    {},
  );
  const message = (code: string) =>
    t.has(`errors.${code}` as "errors.empty")
      ? t(`errors.${code}` as "errors.empty")
      : code;

  return (
    <div className="space-y-5">
      <form
        action={action}
        className="space-y-5"
        onSubmit={(event) => {
          // Keep the pasted rows on screen while the problems are fixed.
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => action(data));
        }}
      >
        <input type="hidden" name="slug" value={slug} />
        <Field id="file" label={t("file")}>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv,text/plain"
            className={cn(inputClass, "h-auto py-2")}
          />
        </Field>
        <Field id="text" label={t("paste")}>
          <textarea
            id="text"
            name="text"
            rows={6}
            spellCheck={false}
            className={cn(inputClass, "h-auto py-2 font-mono text-sm")}
          />
        </Field>
        <Button type="submit" className="h-11 px-6" disabled={pending}>
          {pending ? t("importing") : t("submit")}
        </Button>
      </form>

      {state.done && !pending && (
        <div
          role="status"
          className="rounded-lg border border-highlight-border bg-highlight p-4 text-highlight-foreground"
        >
          <p className="font-medium">{t("done", state.done)}</p>
          <Link href={fleetHref} className="mt-1 inline-block underline">
            {t("viewFleet")}
          </Link>
        </div>
      )}
      {state.fileError && !pending && (
        <p role="alert" className="text-sm text-destructive">
          {message(state.fileError)}
        </p>
      )}
      {state.problems && !pending && (
        <div role="alert" className="space-y-3">
          <p className="font-medium text-destructive">
            {t("problems", { count: state.problems.length })}
          </p>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead className="bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    {t("line")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("column")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("problem")}
                  </th>
                  <th scope="col" className="px-3 py-2">
                    {t("value")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.problems.map((problem, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 tabular-nums">{problem.line}</td>
                    <td className="px-3 py-2 font-mono">{problem.column}</td>
                    <td className="px-3 py-2">{message(problem.code)}</td>
                    <td className="px-3 py-2 font-mono break-all">
                      {problem.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
