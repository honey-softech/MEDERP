"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/auth-shell";

const MAX_WIDTH = 600;
const DEFAULT_THRESHOLD = 200;

type Crop = { x: number; y: number; w: number; h: number };

/**
 * Captures a photo/scan of a signed and sealed sheet of paper and turns it into a
 * transparent PNG that can sit directly on a printed document.
 */
export function SignatureCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [source, setSource] = useState("");
  const [sourceSize, setSourceSize] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setError("Camera permission was denied. Upload a scan instead.");
    }
  }

  function loadSource(dataUrl: string) {
    const image = new Image();
    image.onload = () => {
      sourceRef.current = image;
      setSource(dataUrl);
      setSourceSize({ w: image.width, h: image.height });
      setCrop(null);
    };
    image.onerror = () => setError("That file could not be read as an image.");
    image.src = dataUrl;
  }

  function shoot() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopCamera();
    loadSource(canvas.toDataURL("image/png"));
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = () => loadSource(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  // Redraw the preview whenever the crop box or ink threshold changes.
  useEffect(() => {
    const image = sourceRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    const box = crop ?? { x: 0, y: 0, w: image.width, h: image.height };
    if (box.w < 4 || box.h < 4) return;

    const scale = Math.min(1, MAX_WIDTH / box.w);
    canvas.width = Math.round(box.w * scale);
    canvas.height = Math.round(box.h * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);

    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = frame.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const luminance = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      if (luminance >= threshold) {
        pixels[i + 3] = 0;
        continue;
      }
      // Fade the darkest ink to opaque and near-threshold pixels to soft edges.
      pixels[i + 3] = Math.round(255 * Math.min(1, (threshold - luminance) / Math.max(1, threshold * 0.55)));
      pixels[i] = Math.min(pixels[i], 40);
      pixels[i + 1] = Math.min(pixels[i + 1], 40);
      pixels[i + 2] = Math.min(pixels[i + 2], 60);
    }
    context.putImageData(frame, 0, 0);
  }, [source, crop, threshold]);

  function pointToImage(event: React.PointerEvent<HTMLImageElement>) {
    const image = sourceRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!image || rect.width === 0) return null;
    const ratio = image.width / rect.width;
    return { x: (event.clientX - rect.left) * ratio, y: (event.clientY - rect.top) * ratio };
  }

  function onPointerDown(event: React.PointerEvent<HTMLImageElement>) {
    const point = pointToImage(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = point;
    setCrop({ x: point.x, y: point.y, w: 0, h: 0 });
  }

  function onPointerMove(event: React.PointerEvent<HTMLImageElement>) {
    const start = dragStart.current;
    const point = start ? pointToImage(event) : null;
    if (!start || !point) return;
    setCrop({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    });
  }

  function onPointerUp() {
    dragStart.current = null;
    setCrop((current) => (current && (current.w < 8 || current.h < 8) ? null : current));
  }

  function use() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length > 400_000) {
      setError("Signature image is too large. Crop tighter around the signature and seal.");
      return;
    }
    onCapture(dataUrl);
  }

  const cropStyle =
    crop && sourceSize
      ? {
          left: `${(crop.x / sourceSize.w) * 100}%`,
          top: `${(crop.y / sourceSize.h) * 100}%`,
          width: `${(crop.w / sourceSize.w) * 100}%`,
          height: `${(crop.h / sourceSize.h) * 100}%`,
        }
      : null;

  return (
    <div className="grid gap-3">
      {cameraOn ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg border border-border bg-black" />
          <p className="text-xs text-text-secondary">
            Place the signed and sealed sheet on a flat, well-lit surface and fill the frame with it.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButtonClass} onClick={shoot}>
              Take photo
            </button>
            <button type="button" className={secondaryButtonClass} onClick={stopCamera}>
              Cancel
            </button>
          </div>
        </>
      ) : source ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-text-secondary">
                Drag across the signature and seal to crop
              </p>
              <div className="relative mt-1 select-none overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={source}
                  alt="Uploaded signature sheet"
                  draggable={false}
                  className="w-full cursor-crosshair touch-none"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                />
                {cropStyle ? (
                  <div className="pointer-events-none absolute border-2 border-primary bg-primary/10" style={cropStyle} />
                ) : null}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary">Preview on a printed document</p>
              <div className="mt-1 flex min-h-32 items-center justify-center rounded-lg border border-border bg-white p-3">
                <canvas ref={canvasRef} className="max-h-32 max-w-full" />
              </div>
              <label className="mt-3 block text-xs font-medium text-text-secondary">
                Background removal
                <input
                  type="range"
                  min="90"
                  max="245"
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                  className="mt-1 w-full"
                />
                <span className="font-normal">
                  Slide left if the paper background is still visible, right if strokes are breaking up.
                </span>
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButtonClass} onClick={use}>
              Use this signature
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                sourceRef.current = null;
                setSource("");
                setSourceSize(null);
                setCrop(null);
              }}
            >
              Choose another
            </button>
            <button type="button" className={secondaryButtonClass} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            Ask the staff member to sign and stamp a blank white sheet, then scan or photograph it.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void startCamera()}>
              Open camera
            </button>
            <label className={`${secondaryButtonClass} cursor-pointer`}>
              Upload scan
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
            <button type="button" className={secondaryButtonClass} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      )}
      {error ? <p className="text-xs text-critical">{error}</p> : null}
    </div>
  );
}
