"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stickerToken } from "@/lib/qr-scan";

/** The browser's built-in code reader (not in TypeScript's DOM types yet). */
type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
type DetectorClass = new (options: { formats: string[] }) => Detector;

type Problem = "unsupported" | "denied" | "failed" | "notSticker";

/**
 * A camera button that reads a bike's QR sticker and opens the bike (SPEC ›
 * Staff app 4: "search by plate or scan the bike's QR"). It uses the browser's
 * own code reader, so nothing is uploaded and nothing extra is downloaded.
 * Where the browser has no code reader, it says so and points at the phone's
 * camera app, which opens the same sticker link.
 */
export function QrScanner() {
  const t = useTranslations("Maintenance");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
  }, []);

  const close = useCallback(() => {
    stop();
    setOpen(false);
    setProblem(null);
  }, [stop]);

  // Never leave the camera running when the page is left.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function start() {
    setProblem(null);
    setOpen(true);
    const Reader = (window as unknown as { BarcodeDetector?: DetectorClass })
      .BarcodeDetector;
    if (!Reader || !navigator.mediaDevices?.getUserMedia) {
      setProblem("unsupported");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        // The back camera on a phone; whatever there is on a laptop.
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.current = media;
      if (!video.current) return stop();
      video.current.srcObject = media;
      await video.current.play();
      const reader = new Reader({ formats: ["qr_code"] });
      let busy = false;
      timer.current = setInterval(async () => {
        if (busy || !video.current || video.current.readyState < 2) return;
        busy = true;
        try {
          const [found] = await reader.detect(video.current);
          if (found) {
            const token = stickerToken(found.rawValue);
            if (token) {
              stop();
              router.push(`/q/${token}`);
            } else setProblem("notSticker");
          }
        } catch {
          // A frame that couldn't be read: try the next one.
        } finally {
          busy = false;
        }
      }, 250);
    } catch (error) {
      stop();
      setProblem(
        error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "SecurityError")
          ? "denied"
          : "failed",
      );
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 px-4"
        onClick={start}
      >
        <Camera aria-hidden />
        <span className="max-sm:sr-only">{t("scan")}</span>
      </Button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("scanTitle")}
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 text-white"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("scanTitle")}</h2>
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-transparent px-4 text-white"
              onClick={close}
            >
              <X aria-hidden />
              {tCommon("close")}
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
            {problem !== "unsupported" &&
              problem !== "denied" &&
              problem !== "failed" && (
                <video
                  ref={video}
                  muted
                  playsInline
                  className="max-h-[70svh] w-full max-w-md rounded-lg bg-black object-cover"
                />
              )}
            <p
              role={problem ? "alert" : "status"}
              className="max-w-md text-center"
            >
              {problem ? t(`scanProblem.${problem}`) : t("scanHint")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
