"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useFieldError, useMarkDirty } from "@/components/form-kit";
import {
  fitWithin,
  photoFileProblem,
  photoUrl,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
  uploadErrorProblem,
  type PhotoBucket,
  type PhotoProblem,
} from "@/lib/photos";
import { createClient } from "@/lib/supabase/client";
import { supabaseUrl } from "@/lib/supabase/env";

/**
 * Picks, resizes (WebP, longest edge 1,600 px) and uploads photos straight to
 * Storage, then submits their paths as JSON in a hidden input. The first photo
 * is the main one. Files removed here are deleted from Storage when the form
 * is saved (server side), so an unsaved form never loses a photo.
 */
export function PhotoPicker({
  name = "photos",
  label,
  bucket,
  folder,
  initial,
  max,
}: {
  name?: string;
  label: string;
  bucket: PhotoBucket;
  /** "<shop_id>" or "<shop_id>/<model_id>". */
  folder: string;
  initial: string[];
  max: number;
}) {
  const t = useTranslations("Photos");
  const tErrors = useTranslations("Errors");
  const inputId = useId();
  const [paths, setPaths] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<
    { file: string; problem: PhotoProblem }[]
  >([]);
  const error = useFieldError(name);
  const markDirty = useMarkDirty();

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setProblems([]);
    const supabase = createClient();
    const added: string[] = [];
    const failed: { file: string; problem: PhotoProblem }[] = [];
    for (const file of Array.from(files).slice(0, max - paths.length)) {
      const known = photoFileProblem(file);
      if (known) {
        failed.push({ file: file.name, problem: known });
        continue;
      }
      let resized: { blob: Blob; ext: string };
      try {
        resized = await resize(file);
      } catch {
        failed.push({ file: file.name, problem: "unreadable" });
        continue;
      }
      if (resized.blob.size > PHOTO_MAX_BYTES) {
        failed.push({ file: file.name, problem: "tooLarge" });
        continue;
      }
      const path = `${folder}/${crypto.randomUUID()}.${resized.ext}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, resized.blob, { contentType: resized.blob.type });
      if (error)
        failed.push({ file: file.name, problem: uploadErrorProblem(error) });
      else added.push(path);
    }
    setPaths((current) => [...current, ...added]);
    if (added.length > 0) markDirty();
    setProblems(failed);
    setBusy(false);
  }

  const move = (index: number) => {
    markDirty();
    setPaths((current) => [
      current[index],
      ...current.filter((_, i) => i !== index),
    ]);
  };
  const remove = (index: number) => {
    markDirty();
    setPaths((current) => current.filter((_, i) => i !== index));
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={JSON.stringify(paths)} />
      {paths.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {paths.map((path, i) => (
            <li key={path} className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- Storage URLs, already resized */}
              <img
                src={photoUrl(supabaseUrl(), bucket, path)}
                alt={i === 0 ? t("mainPhoto") : t("photoN", { n: i + 1 })}
                className="aspect-4/3 w-full rounded-md border object-cover"
              />
              <div className="flex flex-wrap gap-2">
                {i > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => move(i)}
                  >
                    {t("makeMain")}
                  </Button>
                )}
                {i === 0 && (
                  <span className="text-sm font-medium">{t("main")}</span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => remove(i)}
                >
                  {t("remove")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {paths.length < max && (
        <div>
          <label
            htmlFor={inputId}
            className="inline-flex h-11 cursor-pointer items-center rounded-md border px-4 font-medium"
          >
            {busy ? t("uploading") : t("add", { left: max - paths.length })}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              void upload(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {t("requirements", { max, edge: PHOTO_MAX_EDGE })}
          </p>
        </div>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {problems.map((p, i) => (
            <li key={`${p.file}-${i}`}>
              {p.file}: {t(`problem.${p.problem}`)}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="text-sm text-destructive">
          {tErrors.has(error) ? tErrors(error) : tErrors("invalid")}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Resizes to PHOTO_MAX_EDGE and encodes as WebP. Safari can't encode WebP
 * (toBlob silently returns a much larger PNG), so fall back to JPEG there.
 */
async function resize(file: File): Promise<{ blob: Blob; ext: string }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
        type,
        0.85,
      ),
    );
  const webp = await encode("image/webp");
  if (webp.type === "image/webp") return { blob: webp, ext: "webp" };
  return { blob: await encode("image/jpeg"), ext: "jpg" };
}
