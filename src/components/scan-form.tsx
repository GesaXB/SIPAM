"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { selfScan } from "@/lib/actions/attendance";
import { SubmitButton } from "./submit-button";

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

export function ScanForm({ disabled, reason }: { disabled: boolean; reason?: string }) {
  const [state, action] = useActionState(selfScan, null);
  const [code, setCode] = useState("");
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function openCamera() {
    setCameraNote(null);
    const DetectorCtor = (
      window as Window & {
        BarcodeDetector?: new (options: { formats: string[] }) => Detector;
      }
    ).BarcodeDetector;
    if (!DetectorCtor || !navigator.mediaDevices) {
      setCameraNote("Kamera pemindai tidak tersedia di peramban ini. Ketik kode dari papan guru.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setOpen(true);
      const detector = new DetectorCtor({ formats: ["qr_code"] });
      const watch = async () => {
        if (!videoRef.current || videoRef.current.srcObject !== stream) return;
        try {
          const hits = await detector.detect(video);
          const raw = hits[0]?.rawValue ?? "";
          const match = raw.toUpperCase().match(/SIPAM:([A-Z0-9]{6})/) ?? raw.toUpperCase().match(/\b([A-Z0-9]{6})\b/);
          if (match) {
            setCode(match[1]);
            stream.getTracks().forEach((track) => track.stop());
            setOpen(false);
            return;
          }
        } catch {
          // Frame tanpa kode diabaikan.
        }
        window.setTimeout(() => void watch(), 350);
      };
      void watch();
    } catch {
      setCameraNote("Kamera tidak dapat dibuka. Izinkan kamera, atau ketik kodenya.");
    }
  }

  return (
    <form action={action} className="space-y-4">
      {disabled ? <p className="border border-brass bg-brass/10 px-3 py-2 text-sm">{reason}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void openCamera()}
          disabled={disabled}
          className="min-h-11 border border-ink px-4 text-sm disabled:opacity-50"
        >
          Buka kamera
        </button>
        <label className="block min-w-48 flex-1 text-sm">
          Kode kehadiran
          <input
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            disabled={disabled}
            autoComplete="off"
            className="mt-1 w-full border border-line bg-paper px-3 py-2 font-mono tracking-[0.3em]"
          />
        </label>
      </div>
      <video ref={videoRef} className={open ? "aspect-square w-full max-w-xs border border-ink bg-ink" : "hidden"} muted playsInline />
      {cameraNote ? <p className="text-sm text-stamp">{cameraNote}</p> : null}
      {state?.error ? <p className="text-sm text-stamp">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-leaf">{state.ok}</p> : null}
      <SubmitButton label="Catat hadir" pendingLabel="Mencatat..." />
    </form>
  );
}
