"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useFieldError } from "@/components/form-kit";
import { fitWithin, photoUrl, type PhotoBucket } from "@/lib/photos";
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
  const [uploadError, setUploadError] = useState(false);
  const error = useFieldError(name);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setUploadError(false);
    const supabase = createClient();
    const added: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, max - paths.length)) {
        const blob = await toWebp(file);
        const path = `${folder}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, blob, { contentType: "image/webp" });
        if (error) throw error;
        added.push(path);
      }
    } catch {
      setUploadError(true);
    } finally {
      setPaths((current) => [...current, ...added]);
      setBusy(false);
    }
  }

  const move = (index: number) =>
    setPaths((current) => [
      current[index],
      ...current.filter((_, i) => i !== index),
    ]);
  const remove = (index: number) =>
    setPaths((current) => current.filter((_, i) => i !== index));

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
        </div>
      )}
      {uploadError && (
        <p className="text-sm text-destructive">{t("uploadFailed")}</p>
      )}
      {error && (
        <p className="text-sm text-destructive">
          {tErrors.has(error) ? tErrors(error) : tErrors("invalid")}
        </p>
      )}
    </fieldset>
  );
}

async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/webp",
      0.85,
    ),
  );
}
