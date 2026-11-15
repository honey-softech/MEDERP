"use client";

import { useEffect, useRef, useState } from "react";
import {
  HANDWRITING_MAX_PAGE_CHARS,
  HANDWRITING_MAX_PAGES,
  pagesReadyToStore,
} from "@/lib/handwriting";

type Point = { x: number; y: number; p: number };
type Tool = "pen" | "eraser";
type Stroke = { tool: Tool; color: string; size: number; points: Point[] };
type PageModel = { id: string; base: string | null; strokes: Stroke[] };

const COLORS = [
  { id: "black", value: "#1a1a1a", label: "Black ink" },
  { id: "blue", value: "#1e3a8a", label: "Blue ink" },
  { id: "red", value: "#991b1b", label: "Red ink" },
] as const;

const SIZES = [
  { id: "fine", value: 1.6, label: "Fine" },
  { id: "medium", value: 2.6, label: "Medium" },
  { id: "broad", value: 4.2, label: "Broad" },
] as const;

const EXPORT_WIDTH = 1200;

function newPage(base: string | null = null): PageModel {
  return { id: Math.random().toString(36).slice(2, 10), base, strokes: [] };
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, width: number, height: number) {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  const scale = width / EXPORT_WIDTH;
  const boost = stroke.tool === "eraser" ? 8 : 1;
  const points = stroke.points;

  const paintSegment = (from: Point, to: Point) => {
    const pressure = ((from.p > 0 ? from.p : 0.5) + (to.p > 0 ? to.p : 0.5)) / 2;
    ctx.beginPath();
    ctx.lineWidth = stroke.size * (0.45 + pressure) * scale * boost;
    ctx.moveTo(from.x * width, from.y * height);
    const midX = ((from.x + to.x) / 2) * width;
    const midY = ((from.y + to.y) / 2) * height;
    ctx.quadraticCurveTo(from.x * width, from.y * height, midX, midY);
    ctx.stroke();
  };

  if (points.length === 1) {
    const point = points[0];
    paintSegment(point, { ...point, x: Math.min(1, point.x + 0.0008) });
  } else {
    for (let index = 1; index < points.length; index += 1) {
      paintSegment(points[index - 1], points[index]);
    }
  }
  ctx.restore();
}

function drawPage(
  ctx: CanvasRenderingContext2D,
  page: PageModel,
  width: number,
  height: number,
  images: Map<string, HTMLImageElement>,
) {
  ctx.clearRect(0, 0, width, height);
  if (page.base) {
    const image = images.get(page.base);
    if (image?.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, 0, 0, width, height);
    }
  }
  for (const stroke of page.strokes) drawStroke(ctx, stroke, width, height);
}

function exportPage(page: PageModel, images: Map<string, HTMLImageElement>): string | null | false {
  if (page.base) {
    const image = images.get(page.base);
    if (!image?.complete || image.naturalWidth === 0) return false;
  }
  if (!page.base && page.strokes.length === 0) return null;
  const paint = (width: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(width * (297 / 210));
    const context = canvas.getContext("2d");
    if (!context) return null;
    drawPage(context, page, canvas.width, canvas.height, images);
    return canvas.toDataURL("image/png");
  };

  const full = paint(EXPORT_WIDTH);
  if (!full) return null;
  if (full.length <= HANDWRITING_MAX_PAGE_CHARS) return full;
  const scale = Math.max(0.45, Math.sqrt(HANDWRITING_MAX_PAGE_CHARS / full.length) * 0.92);
  return paint(Math.round(EXPORT_WIDTH * scale));
}

export function HandwritingPad({
  initialPages = [],
  onChange,
}: {
  initialPages?: string[];
  onChange: (pages: string[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<PageModel[]>(
    initialPages.length > 0 ? initialPages.map((page) => newPage(page)) : [newPage()],
  );
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const lastEmitRef = useRef(JSON.stringify(pagesReadyToStore(initialPages)));
  const onChangeRef = useRef(onChange);
  const toolRef = useRef<Tool>("pen");
  const colorRef = useRef<string>(COLORS[0].value);
  const sizeRef = useRef<number>(SIZES[1].value);
  const penOnlyRef = useRef(false);
  const sawPenRef = useRef(false);
  const paintingRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);
  const indexRef = useRef(0);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(pagesRef.current.length);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [size, setSize] = useState<number>(SIZES[1].value);
  const [penOnly, setPenOnly] = useState(false);
  const [revision, setRevision] = useState(0);

  onChangeRef.current = onChange;
  toolRef.current = tool;
  colorRef.current = color;
  sizeRef.current = size;
  penOnlyRef.current = penOnly;
  indexRef.current = pageIndex;

  function rememberImage(src: string) {
    if (!src || imagesRef.current.has(src)) return;
    const image = new Image();
    image.onload = () => {
      paint();
      if (pagesRef.current.some((page) => page.strokes.length > 0)) emit();
    };
    image.src = src;
    imagesRef.current.set(src, image);
  }

  function paint() {
    const canvas = canvasRef.current;
    const page = pagesRef.current[indexRef.current];
    if (!canvas || !page) return;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (cssWidth < 2 || cssHeight < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bitmapWidth = Math.max(1, Math.round(cssWidth * dpr));
    const bitmapHeight = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(bitmapWidth / cssWidth, 0, 0, bitmapHeight / cssHeight, 0, 0);
    drawPage(context, page, cssWidth, cssHeight, imagesRef.current);
  }

  function emit() {
    const urls = pagesRef.current.map((page) => exportPage(page, imagesRef.current));
    if (urls.some((url) => url === false)) return;
    const ready = pagesReadyToStore(urls.filter((url): url is string | null => url !== false));
    const serialized = JSON.stringify(ready);
    if (serialized === lastEmitRef.current) return;
    lastEmitRef.current = serialized;
    onChangeRef.current(ready);
  }

  function bump() {
    setRevision((value) => value + 1);
  }

  useEffect(() => {
    for (const page of pagesRef.current) {
      if (page.base) rememberImage(page.base);
    }
    paint();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(wrap);
    return () => observer.disconnect();
    // Paint when the visible page changes. Strokes update the canvas directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, pageCount]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    const pressure = event.pointerType === "mouse" ? 0.5 : event.pressure || 0.5;
    return {
      x: rect.width ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0,
      y: rect.height ? Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) : 0,
      p: pressure,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (penOnlyRef.current && event.pointerType === "touch") return;
    if (event.pointerType === "touch" && sawPenRef.current) return;
    if (event.pointerType === "pen") sawPenRef.current = true;
    const page = pagesRef.current[indexRef.current];
    if (!page) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    paintingRef.current = true;
    page.strokes.push({
      tool: toolRef.current,
      color: colorRef.current,
      size: sizeRef.current,
      points: [pointFromEvent(event)],
    });
    paint();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!paintingRef.current || event.pointerId !== activePointerRef.current) return;
    const page = pagesRef.current[indexRef.current];
    const stroke = page?.strokes[page.strokes.length - 1];
    if (!stroke) return;
    stroke.points.push(pointFromEvent(event));
    paint();
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerId !== activePointerRef.current) return;
    paintingRef.current = false;
    activePointerRef.current = null;
    emit();
    bump();
  }

  function undo() {
    const page = pagesRef.current[indexRef.current];
    if (!page || page.strokes.length === 0) return;
    page.strokes.pop();
    paint();
    emit();
    bump();
  }

  function clearPage() {
    const page = pagesRef.current[indexRef.current];
    if (!page) return;
    page.strokes = [];
    page.base = null;
    paint();
    emit();
    bump();
  }

  function addPage() {
    if (pagesRef.current.length >= HANDWRITING_MAX_PAGES) return;
    pagesRef.current.push(newPage());
    const next = pagesRef.current.length - 1;
    setPageCount(pagesRef.current.length);
    setPageIndex(next);
  }

  function removePage() {
    if (pagesRef.current.length <= 1) {
      clearPage();
      return;
    }
    pagesRef.current.splice(indexRef.current, 1);
    const next = Math.max(0, indexRef.current - 1);
    setPageCount(pagesRef.current.length);
    setPageIndex(next);
    emit();
  }

  const active = pagesRef.current[pageIndex];
  const canUndo = Boolean(active && active.strokes.length > 0);
  void revision;

  const toolButton = (activeTool: boolean) =>
    `rounded-md px-2 py-1 text-xs font-medium ${
      activeTool ? "bg-primary text-white" : "text-text-secondary hover:bg-app-bg"
    }`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          <button type="button" className={toolButton(tool === "pen")} onClick={() => setTool("pen")}>
            Pen
          </button>
          <button type="button" className={toolButton(tool === "eraser")} onClick={() => setTool("eraser")}>
            Eraser
          </button>
        </div>
        <div className="inline-flex items-center gap-1">
          {COLORS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-pressed={color === item.value}
              className={`h-5 w-5 rounded-full border ${color === item.value ? "ring-2 ring-primary ring-offset-1" : "border-border"}`}
              style={{ backgroundColor: item.value }}
              onClick={() => {
                setColor(item.value);
                setTool("pen");
              }}
            />
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          {SIZES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={toolButton(size === item.value)}
              onClick={() => setSize(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className={toolButton(false)} disabled={!canUndo} onClick={undo}>
          Undo
        </button>
        <button type="button" className={toolButton(false)} onClick={clearPage}>
          Clear
        </button>
        <button
          type="button"
          aria-pressed={penOnly}
          className={toolButton(penOnly)}
          onClick={() => setPenOnly((value) => !value)}
        >
          Pen only
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: pageCount }, (_, index) => (
          <button
            key={pagesRef.current[index]?.id ?? index}
            type="button"
            className={toolButton(index === pageIndex)}
            onClick={() => setPageIndex(index)}
          >
            Page {index + 1}
          </button>
        ))}
        <button
          type="button"
          className={toolButton(false)}
          disabled={pageCount >= HANDWRITING_MAX_PAGES}
          onClick={addPage}
        >
          Add page
        </button>
        {pageCount > 1 ? (
          <button type="button" className={toolButton(false)} onClick={removePage}>
            Remove page
          </button>
        ) : null}
      </div>

      <div
        ref={wrapRef}
        className="overflow-hidden rounded-lg border border-[#c8c8c8] bg-white"
        style={{
          aspectRatio: "210 / 297",
          backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 27px, #eceae6 28px)",
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label={`Handwriting page ${pageIndex + 1}`}
          className="h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
      </div>
      <p className="text-[11px] text-text-secondary">
        Write with a stylus, finger, or mouse. Pen only ignores a resting palm. Lines on the page are a guide and are not saved.
      </p>
    </div>
  );
}
