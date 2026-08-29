"use client";

import { useEffect, useRef, useState } from "react";
import { secondaryButtonClass } from "@/components/auth-shell";

export function PhotoCapture({
  value,
  onChange,
  label = "Photo",
  variant = "default",
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  variant?: "default" | "frame" | "compact" | "logo";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [cameraOn]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError("Camera permission was denied. You can upload a photo instead.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const size = Math.min(video.videoWidth || 480, 640);
    const scale = size / (video.videoWidth || size);
    canvas.width = size;
    canvas.height = Math.round((video.videoHeight || size) * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL("image/jpeg", 0.72));
    stopCamera();
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (variant === "logo" && dataUrl.startsWith("data:image/") && dataUrl.length <= 1_500_000) {
        onChange(dataUrl);
        return;
      }
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const max = variant === "logo" ? 512 : 640;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        onChange(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  const frame = variant === "frame";
  const compact = variant === "compact";
  const logo = variant === "logo";
  const actionClass = compact
    ? "text-right text-xs font-medium text-teal-700 hover:underline"
    : secondaryButtonClass;

  return (
    <div
      className={
        compact
          ? ""
          : frame
            ? "overflow-hidden rounded-2xl border border-slate-200 bg-white"
            : "md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4"
      }
    >
      {frame || compact ? null : <p className="text-sm font-medium text-slate-700">{label}</p>}
      <div className={compact || frame ? "flex flex-col" : "mt-3 flex flex-wrap items-start gap-4"}>
        <div
          className={
            compact
              ? "h-32 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
              : frame
                ? "aspect-[3/4] w-full overflow-hidden bg-slate-100"
                : logo
                  ? "flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  : "h-36 w-36 overflow-hidden rounded-2xl border border-slate-200 bg-white"
          }
        >
          {cameraOn ? (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover object-center" />
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Captured"
              className={logo ? "max-h-full max-w-full object-contain" : "h-full w-full object-cover object-center"}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-sm text-slate-400">
              {logo ? "No icon" : "No photo"}
            </div>
          )}
        </div>
        <div className={compact ? "mt-2 flex flex-col items-end gap-1" : frame ? "flex flex-wrap gap-2 p-3" : "flex flex-wrap gap-2"}>
          {cameraOn ? (
            <>
              <button type="button" className={actionClass} onClick={capture}>
                Capture
              </button>
              <button type="button" className={actionClass} onClick={stopCamera}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {logo ? null : (
                <button type="button" className={actionClass} onClick={() => void startCamera()}>
                  {compact ? "Camera" : "Open camera"}
                </button>
              )}
              <label className={`${actionClass} cursor-pointer`}>
                {logo ? "Upload icon" : compact ? "Upload" : "Upload photo"}
                <input type="file" accept="image/*" capture={logo ? undefined : "user"} className="hidden" onChange={onFile} />
              </label>
              {value ? (
                <button type="button" className={actionClass} onClick={() => onChange("")}>
                  Remove
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
      {error ? <p className={`${compact ? "mt-1" : frame ? "px-3 pb-3" : "mt-2"} text-xs text-red-600`}>{error}</p> : null}
    </div>
  );
}
