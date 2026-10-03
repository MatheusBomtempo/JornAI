"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "./LocaleProvider";
import { Tooltip } from "./Tooltip";

/**
 * URL exclusive to the canvas (Fabric and the photo editor load with crossOrigin
 * "anonymous"). The same image shows up on screen in plain <img> tags (template
 * and photo thumbnails), loaded WITHOUT CORS — and R2 does not send `Vary:
 * Origin` on that response, so the browser reused the non-CORS copy for the
 * canvas and blocked it. In production the editor opened with only the photo: no
 * frame and no title/subtitle (locally it does not show up: there everything is
 * the same origin). A query param becomes another cache entry; R2 ignores it and
 * serves the same file.
 */
export function canvasUrl(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}cors=1`;
}

export interface EditFrame {
  width: number;
  height: number;
}

// ── Editor model ─────────────────────────────────────────────

interface View {
  /** 1 = "base" size (cover, or whole photo when the blurred borders are on). */
  zoom: number;
  /** Frame units (the same ones as `frame`), from the centered position. */
  panX: number;
  panY: number;
  /** Fine rotation in degrees, on top of the quarter turns. */
  angle: number;
  turns: number;
  flip: boolean;
  borders: boolean;
}

interface Color {
  /** Percent — 100 is untouched, like CSS filter(). */
  brightness: number;
  contrast: number;
  saturation: number;
}

type Tool = "adjust" | "color" | "blur";

const INITIAL_VIEW: View = { zoom: 1, panX: 0, panY: 0, angle: 0, turns: 0, flip: false, borders: false };
const INITIAL_COLOR: Color = { brightness: 100, contrast: 100, saturation: 100 };
const ZOOM_MAX = 4;
const PREVIEW_MAX = 900;
const EXPORT_MAX = 1600;
const SOURCE_MAX = 2048;
const UNDO_MAX = 30;
const BG_LONG_SIDE = 80;
const EMPTY_BG = "#0c0e12";

const rad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Canvas width that makes the frame's longer side `long` pixels. */
const widthForLongSide = (frame: EditFrame, long: number) =>
  Math.round((frame.width / Math.max(frame.width, frame.height)) * long);

interface Geometry {
  s: number;
  base: number;
  limX: number;
  limY: number;
}

/**
 * Size of the photo in the frame. `base` is "cover" (the frame is always
 * covered, also when straightened) or, with the blurred borders on, "contain"
 * (the whole photo). The pan limits are measured along the photo's own axes.
 */
function geometry(v: View, src: { w: number; h: number }, frame: EditFrame): Geometry {
  const odd = v.turns % 2 !== 0;
  const ew = odd ? src.h : src.w;
  const eh = odd ? src.w : src.h;
  const a = rad(v.angle);
  const bw = frame.width * Math.abs(Math.cos(a)) + frame.height * Math.abs(Math.sin(a));
  const bh = frame.width * Math.abs(Math.sin(a)) + frame.height * Math.abs(Math.cos(a));
  const base = v.borders
    ? Math.min(frame.width / ew, frame.height / eh)
    : Math.max(bw / ew, bh / eh);
  const s = base * v.zoom;
  return { s, base, limX: Math.abs(ew * s - bw) / 2, limY: Math.abs(eh * s - bh) / 2 };
}

/** Keeps the photo covering the frame (or fully inside it, with the borders on). */
function clampView(v: View, src: { w: number; h: number }, frame: EditFrame): View {
  const zoom = clamp(v.zoom, 1, ZOOM_MAX);
  const next = { ...v, zoom };
  const g = geometry(next, src, frame);
  const a = rad(v.angle);
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const qx = clamp(v.panX * c + v.panY * sn, -g.limX, g.limX);
  const qy = clamp(-v.panX * sn + v.panY * c, -g.limY, g.limY);
  return { ...next, panX: qx * c - qy * sn, panY: qx * sn + qy * c };
}

// ── Pixels ───────────────────────────────────────────────────

/** Running-sum box blur along one axis, edges clamped. */
function boxBlurPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
  horizontal: boolean,
) {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const step = horizontal ? 4 : w * 4;
  const lineStep = horizontal ? w * 4 : 4;
  const div = 2 * r + 1;
  for (let l = 0; l < lines; l++) {
    const base = l * lineStep;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[base + clamp(i, 0, len - 1) * step + c];
      for (let i = 0; i < len; i++) {
        dst[base + i * step + c] = sum / div;
        sum += src[base + Math.min(len - 1, i + r + 1) * step + c] - src[base + Math.max(0, i - r) * step + c];
      }
    }
  }
}

function boxBlur(img: ImageData, r: number, passes: number) {
  const tmp = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < passes; i++) {
    boxBlurPass(img.data, tmp, img.width, img.height, r, true);
    boxBlurPass(tmp, img.data, img.width, img.height, r, false);
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/**
 * Same look as the video's blurred background (blurPadGraph in render/video.ts):
 * the photo enlarged to cover the frame, mirrored, blurred, a bit darker and
 * less saturated. Built tiny and scaled up — the scaling is part of the blur and
 * does not depend on `ctx.filter` (missing on iOS Safari).
 */
function buildBackground(
  work: HTMLCanvasElement,
  v: Pick<View, "turns" | "flip">,
  frame: EditFrame,
): HTMLCanvasElement {
  const k = BG_LONG_SIDE / Math.max(frame.width, frame.height);
  const small = makeCanvas(Math.max(24, frame.width * k), Math.max(24, frame.height * k));
  const ctx = small.getContext("2d")!;
  const odd = v.turns % 2 !== 0;
  const ew = odd ? work.height : work.width;
  const eh = odd ? work.width : work.height;
  const sc = Math.max(small.width / ew, small.height / eh);
  ctx.translate(small.width / 2, small.height / 2);
  ctx.scale(-1, 1); // the mirroring of the videos
  ctx.rotate((v.turns * Math.PI) / 2);
  if (v.flip) ctx.scale(-1, 1);
  ctx.scale(sc, sc);
  ctx.drawImage(work, -work.width / 2, -work.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const img = ctx.getImageData(0, 0, small.width, small.height);
  boxBlur(img, 3, 2);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] - 20;
    const g = d[i + 1] - 20;
    const b = d[i + 2] - 20;
    const l = 0.213 * r + 0.715 * g + 0.072 * b;
    d[i] = l + (r - l) * 0.85;
    d[i + 1] = l + (g - l) * 0.85;
    d[i + 2] = l + (b - l) * 0.85;
  }
  ctx.putImageData(img, 0, 0);
  return small;
}

/** brightness → contrast → saturation, the CSS filter() formulas, written into the pixels. */
function applyColor(ctx: CanvasRenderingContext2D, w: number, h: number, c: Color) {
  if (c.brightness === 100 && c.contrast === 100 && c.saturation === 100) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const b = c.brightness / 100;
  const k = c.contrast / 100;
  const sat = c.saturation / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = (d[i] * b - 127.5) * k + 127.5;
    let g = (d[i + 1] * b - 127.5) * k + 127.5;
    let bl = (d[i + 2] * b - 127.5) * k + 127.5;
    r = clamp(r, 0, 255);
    g = clamp(g, 0, 255);
    bl = clamp(bl, 0, 255);
    const l = 0.213 * r + 0.715 * g + 0.072 * bl;
    d[i] = l + (r - l) * sat;
    d[i + 1] = l + (g - l) * sat;
    d[i + 2] = l + (bl - l) * sat;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * One soft round "dab" of blur on the working copy of the photo. Blurs a reduced
 * copy of the area (cheap even with a big brush on a phone) and fades it out at
 * the edge so the spot does not look like a sticker.
 */
function blurDab(work: HTMLCanvasElement, x: number, y: number, radius: number) {
  const x0 = Math.max(0, Math.floor(x - radius));
  const y0 = Math.max(0, Math.floor(y - radius));
  const x1 = Math.min(work.width, Math.ceil(x + radius));
  const y1 = Math.min(work.height, Math.ceil(y + radius));
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw < 2 || bh < 2) return;

  const f = Math.max(1, Math.round(radius / 24));
  const small = makeCanvas(bw / f, bh / f);
  const sctx = small.getContext("2d")!;
  sctx.drawImage(work, x0, y0, bw, bh, 0, 0, small.width, small.height);
  const img = sctx.getImageData(0, 0, small.width, small.height);
  boxBlur(img, Math.max(2, Math.round((radius * 0.4) / f)), 3);
  sctx.putImageData(img, 0, 0);

  const patch = makeCanvas(bw, bh);
  const pctx = patch.getContext("2d")!;
  pctx.imageSmoothingQuality = "high";
  pctx.drawImage(small, 0, 0, bw, bh);
  pctx.globalCompositeOperation = "destination-in";
  const grad = pctx.createRadialGradient(x - x0, y - y0, 0, x - x0, y - y0, radius);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(0.7, "rgba(0,0,0,1)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  pctx.fillStyle = grad;
  pctx.fillRect(0, 0, bw, bh);

  work.getContext("2d")!.drawImage(patch, x0, y0);
}

// ── Component ────────────────────────────────────────────────

interface Props {
  /** Original URL of the photo (the canvas variant is derived here). */
  photoUrl: string;
  /** Real proportion of where the photo ends up — template photo slot, or the whole canvas in a carousel. */
  frame: EditFrame;
  onClose: () => void;
  /** Receives the edited photo, already cropped to the frame's proportion. */
  onApply: (file: File) => void | Promise<void>;
}

export function PhotoEditModal({ photoUrl, frame, onClose, onApply }: Props) {
  const { dict } = useLocale();
  const t = dict.artEditor.photoEdit;

  const holderRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const originalRef = useRef<HTMLImageElement | null>(null);
  const bgRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const rafRef = useRef(0);

  const [src, setSrc] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [color, setColor] = useState<Color>(INITIAL_COLOR);
  const [tool, setTool] = useState<Tool>("adjust");
  const [brush, setBrush] = useState(0.1); // radius, as a fraction of the frame width
  const [strokes, setStrokes] = useState(0);
  const [applying, setApplying] = useState(false);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null);

  // Mirrors for the pointer handlers, which must see the latest values without re-binding.
  const live = useRef({ view, tool, brush, src });
  live.current = { view, tool, brush, src };
  const strokeVersion = useRef(0);
  const undoStack = useRef<{ x: number; y: number; data: ImageData }[]>([]);

  // Escape closes; the page behind does not scroll while the popup is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // The frame takes the biggest size with the art's proportion that fits the space left
  // between the header and the tools (so it never runs over them, on any screen).
  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!cw || !ch) return;
      const k = Math.min(cw / frame.width, ch / frame.height);
      setBoxSize({ w: Math.floor(frame.width * k), h: Math.floor(frame.height * k) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame]);

  // Loads the photo into a working canvas — the brush paints on THIS copy, so the blur
  // stays on the faces even after moving/rotating/zooming.
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const k = Math.min(1, SOURCE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const work = makeCanvas(img.naturalWidth * k, img.naturalHeight * k);
      work.getContext("2d")!.drawImage(img, 0, 0, work.width, work.height);
      originalRef.current = img;
      workRef.current = work;
      setSrc({ w: work.width, h: work.height });
    };
    img.onerror = () => !cancelled && setFailed(true);
    img.src = canvasUrl(photoUrl);
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  /** Draws the frame (background, photo) at `outW` pixels wide — used by the preview and the export. */
  const compose = useCallback(
    (canvas: HTMLCanvasElement, outW: number, v: View) => {
      const work = workRef.current;
      const size = live.current.src;
      if (!work || !size) return;
      const outH = Math.round((outW * frame.height) / frame.width);
      if (canvas.width !== outW) canvas.width = outW;
      if (canvas.height !== outH) canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      const k = outW / frame.width;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (v.borders) {
        const key = `${strokeVersion.current}|${v.turns}|${v.flip}`;
        if (bgRef.current?.key !== key) {
          bgRef.current = { key, canvas: buildBackground(work, v, frame) };
        }
        ctx.drawImage(bgRef.current.canvas, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = EMPTY_BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const g = geometry(v, size, frame);
      ctx.save();
      ctx.scale(k, k);
      ctx.translate(frame.width / 2 + v.panX, frame.height / 2 + v.panY);
      ctx.rotate(rad(v.turns * 90 + v.angle));
      if (v.flip) ctx.scale(-1, 1);
      ctx.scale(g.s, g.s);
      ctx.drawImage(work, -work.width / 2, -work.height / 2);
      ctx.restore();
    },
    [frame],
  );

  const render = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      compose(canvas, widthForLongSide(frame, PREVIEW_MAX), live.current.view);
    });
  }, [compose, frame]);

  useEffect(() => {
    if (src) render();
    return () => cancelAnimationFrame(rafRef.current);
  }, [src, view, render]);

  /** Applies a change to the view and keeps the photo inside its limits. */
  const update = useCallback(
    (patch: Partial<View> | ((v: View) => Partial<View>)) =>
      setView((v) => {
        const s = live.current.src;
        const next = { ...v, ...(typeof patch === "function" ? patch(v) : patch) };
        return s ? clampView(next, s, frame) : next;
      }),
    [frame],
  );

  const zoomTo = (zoom: number) =>
    update((v) => {
      const z = clamp(zoom, 1, ZOOM_MAX);
      const ratio = z / v.zoom;
      return { zoom: z, panX: v.panX * ratio, panY: v.panY * ratio };
    });

  // ── Pointers: one finger/mouse moves or blurs, two fingers zoom ──
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; zoom: number } | null>(null);
  const stroke = useRef<{ last: { x: number; y: number }; snap: HTMLCanvasElement; rect: { x0: number; y0: number; x1: number; y1: number } } | null>(null);

  /** Pointer (screen) → frame units. */
  const toFrame = (clientX: number, clientY: number) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * frame.width, y: ((clientY - r.top) / r.height) * frame.height };
  };

  /** Frame units → pixel of the working copy (inverse of what compose() draws). */
  const toSource = (p: { x: number; y: number }) => {
    const { view: v, src: size } = live.current;
    const g = geometry(v, size!, frame);
    const th = -rad(v.turns * 90 + v.angle);
    const dx = p.x - frame.width / 2 - v.panX;
    const dy = p.y - frame.height / 2 - v.panY;
    let sx = (dx * Math.cos(th) - dy * Math.sin(th)) / g.s;
    const sy = (dx * Math.sin(th) + dy * Math.cos(th)) / g.s;
    if (v.flip) sx = -sx;
    return { x: sx + size!.w / 2, y: sy + size!.h / 2, scale: g.s };
  };

  const moveCursor = (clientX: number, clientY: number, visible: boolean) => {
    const box = boxRef.current;
    const el = cursorRef.current;
    if (!box || !el) return;
    const r = box.getBoundingClientRect();
    const d = live.current.brush * r.width * 2;
    el.style.width = el.style.height = `${d}px`;
    el.style.transform = `translate(${clientX - r.left - d / 2}px, ${clientY - r.top - d / 2}px)`;
    el.style.opacity = visible ? "1" : "0";
  };

  /** Blurs along the segment so a fast swipe leaves a continuous trail. */
  const dabTo = (to: { x: number; y: number }) => {
    const st = stroke.current;
    const work = workRef.current;
    if (!st || !work) return;
    const a = toSource(st.last);
    const b = toSource(to);
    const radius = Math.max(6, (live.current.brush * frame.width) / b.scale);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(dist / (radius * 0.35)));
    for (let i = 1; i <= n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n;
      const y = a.y + ((b.y - a.y) * i) / n;
      blurDab(work, x, y, radius);
      st.rect.x0 = Math.min(st.rect.x0, x - radius);
      st.rect.y0 = Math.min(st.rect.y0, y - radius);
      st.rect.x1 = Math.max(st.rect.x1, x + radius);
      st.rect.y1 = Math.max(st.rect.y1, y + radius);
    }
    st.last = to;
    render();
  };

  const startStroke = (p: { x: number; y: number }) => {
    const work = workRef.current;
    if (!work) return;
    const snap = makeCanvas(work.width, work.height);
    snap.getContext("2d")!.drawImage(work, 0, 0);
    stroke.current = { last: p, snap, rect: { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity } };
    dabTo(p);
  };

  const endStroke = () => {
    const st = stroke.current;
    const work = workRef.current;
    stroke.current = null;
    if (!st || !work || st.rect.x1 <= st.rect.x0) return;
    // Only the touched rectangle is kept for Undo — not a copy of the whole photo.
    const x = clamp(Math.floor(st.rect.x0), 0, work.width - 1);
    const y = clamp(Math.floor(st.rect.y0), 0, work.height - 1);
    const w = clamp(Math.ceil(st.rect.x1) - x, 1, work.width - x);
    const h = clamp(Math.ceil(st.rect.y1) - y, 1, work.height - y);
    undoStack.current.push({ x, y, data: st.snap.getContext("2d")!.getImageData(x, y, w, h) });
    if (undoStack.current.length > UNDO_MAX) undoStack.current.shift();
    strokeVersion.current++;
    setStrokes(undoStack.current.length);
    render();
  };

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!live.current.src) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (live.current.tool === "blur") {
      if (pointers.current.size === 1) startStroke(toFrame(e.clientX, e.clientY));
      moveCursor(e.clientX, e.clientY, true);
      return;
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: live.current.view.zoom };
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (live.current.tool === "blur") {
      moveCursor(e.clientX, e.clientY, e.pointerType !== "touch" || !!prev);
      if (prev && stroke.current) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        dabTo(toFrame(e.clientX, e.clientY));
      }
      return;
    }
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const box = boxRef.current;
    if (!box) return;
    if (pointers.current.size >= 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      zoomTo(gesture.current.zoom * (dist / gesture.current.dist));
      return;
    }
    const k = frame.width / box.clientWidth;
    update((v) => ({ panX: v.panX + (cur.x - prev.x) * k, panY: v.panY + (cur.y - prev.y) * k }));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
    if (live.current.tool === "blur") {
      endStroke();
      if (e.pointerType === "touch") moveCursor(e.clientX, e.clientY, false);
    }
  }

  function undo() {
    const last = undoStack.current.pop();
    const work = workRef.current;
    if (!last || !work) return;
    work.getContext("2d")!.putImageData(last.data, last.x, last.y);
    strokeVersion.current++;
    setStrokes(undoStack.current.length);
    render();
  }

  function clearBlur() {
    const work = workRef.current;
    const original = originalRef.current;
    if (!work || !original) return;
    const ctx = work.getContext("2d")!;
    ctx.clearRect(0, 0, work.width, work.height);
    ctx.drawImage(original, 0, 0, work.width, work.height);
    undoStack.current = [];
    strokeVersion.current++;
    setStrokes(0);
    render();
  }

  const colorChanged =
    color.brightness !== 100 || color.contrast !== 100 || color.saturation !== 100;
  const dirty =
    strokes > 0 ||
    colorChanged ||
    view.zoom !== 1 ||
    view.panX !== 0 ||
    view.panY !== 0 ||
    view.angle !== 0 ||
    view.turns % 4 !== 0 ||
    view.flip ||
    view.borders;

  async function apply() {
    if (!src || applying) return;
    setApplying(true);
    try {
      const out = makeCanvas(1, 1);
      compose(out, widthForLongSide(frame, EXPORT_MAX), live.current.view);
      applyColor(out.getContext("2d")!, out.width, out.height, color);
      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("toBlob failed");
      const file = new File([blob], `edited-${Date.now()}.jpg`, { type: "image/jpeg" });
      onClose();
      void onApply(file);
    } catch (err) {
      console.warn("[JornAI] could not export the edited photo:", err);
      setFailed(true);
      setApplying(false);
    }
  }

  const tabs: { id: Tool; label: string }[] = [
    { id: "adjust", label: t.tabAdjust },
    { id: "color", label: t.tabColor },
    { id: "blur", label: t.tabBlur },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card flex h-[100dvh] w-full flex-col overflow-hidden p-3 max-sm:rounded-none max-sm:border-0 sm:h-[min(92vh,860px)] sm:max-w-lg sm:p-5"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-edit-title"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="photo-edit-title" className="text-sm font-semibold">{t.title}</h2>
            <p className="hint mb-0 mt-0.5">{t.hint}</p>
          </div>
          <button type="button" className="btn-subtle btn-sm shrink-0" onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </div>

        {/* Frame with the real proportion; as big as the free space allows. */}
        <div ref={holderRef} className="flex min-h-0 flex-1 items-center justify-center py-1">
          <div
            ref={boxRef}
            className="relative touch-none select-none overflow-hidden rounded-xl border border-line bg-black"
            style={{
              aspectRatio: `${frame.width} / ${frame.height}`,
              width: boxSize?.w ?? "100%",
              height: boxSize?.h,
              cursor: tool === "blur" ? "crosshair" : "grab",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => tool === "blur" && moveCursor(0, 0, false)}
            onWheel={(e) => tool === "adjust" && zoomTo(view.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          >
            <canvas
              ref={canvasRef}
              className="pointer-events-none h-full w-full"
              style={{
                filter: colorChanged
                  ? `brightness(${color.brightness}%) contrast(${color.contrast}%) saturate(${color.saturation}%)`
                  : undefined,
              }}
            />
            <div
              ref={cursorRef}
              className="pointer-events-none absolute left-0 top-0 rounded-full border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
              style={{ opacity: 0 }}
            />
            {!src && (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-faint">
                {failed ? t.loadError : t.loading}
              </p>
            )}
          </div>
        </div>

        {failed && src && <p className="alert-error mb-2">{t.loadError}</p>}

        <div className="mb-2 flex items-center gap-2" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tool === tab.id}
              onClick={() => setTool(tab.id)}
              className={`btn-sm flex-1 ${tool === tab.id ? "btn-primary" : "btn-ghost"}`}
            >
              {tab.label}
            </button>
          ))}
          <Tooltip text={t.blurTooltip} align="right" />
        </div>

        {/* Fixed height: the frame above must not jump when switching tools. */}
        <div className="card-soft h-[30dvh] min-h-[11.5rem] shrink-0 space-y-3 overflow-y-auto p-3">
          {tool === "adjust" && (
            <>
              <Slider id="pe-zoom" label={t.zoom} value={view.zoom} min={1} max={ZOOM_MAX} step={0.01}
                format={(v) => `${v.toFixed(2)}×`} disabled={!src} onChange={zoomTo} />
              <Slider id="pe-angle" label={t.straighten} value={view.angle} min={-45} max={45} step={0.5}
                format={(v) => `${v.toFixed(1)}°`} disabled={!src} onChange={(angle) => update({ angle })} />
              <div className="grid grid-cols-4 gap-2">
                <button type="button" className="btn-ghost btn-sm px-0" disabled={!src} aria-label={t.rotateLeft}
                  title={t.rotateLeft} onClick={() => update((v) => ({ turns: (v.turns + 3) % 4 }))}>↺</button>
                <button type="button" className="btn-ghost btn-sm px-0" disabled={!src} aria-label={t.rotateRight}
                  title={t.rotateRight} onClick={() => update((v) => ({ turns: (v.turns + 1) % 4 }))}>↻</button>
                <button type="button" className="btn-ghost btn-sm px-0" disabled={!src} aria-label={t.flip}
                  title={t.flip} onClick={() => update((v) => ({ flip: !v.flip }))}>⇋</button>
                <button type="button" className="btn-ghost btn-sm px-0" disabled={!src}
                  onClick={() => update({ panX: 0, panY: 0 })}>{t.center}</button>
              </div>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={view.borders} className="mt-1 h-5 w-5 shrink-0 accent-white"
                  onChange={(e) => update({ borders: e.target.checked })} />
                <span>
                  <span className="block text-sm font-medium">{t.bordersLabel}</span>
                  <span className="hint my-0 block">{t.bordersHint}</span>
                </span>
              </label>
            </>
          )}

          {tool === "color" && (
            <>
              <Slider id="pe-bright" label={t.brightness} value={color.brightness} min={50} max={150} step={1}
                format={(v) => `${v}%`} onChange={(brightness) => setColor((c) => ({ ...c, brightness }))} />
              <Slider id="pe-contrast" label={t.contrast} value={color.contrast} min={50} max={150} step={1}
                format={(v) => `${v}%`} onChange={(contrast) => setColor((c) => ({ ...c, contrast }))} />
              <Slider id="pe-sat" label={t.saturation} value={color.saturation} min={0} max={200} step={1}
                format={(v) => `${v}%`} onChange={(saturation) => setColor((c) => ({ ...c, saturation }))} />
              <button type="button" className="btn-ghost btn-sm w-full" disabled={!colorChanged}
                onClick={() => setColor(INITIAL_COLOR)}>{t.resetColor}</button>
            </>
          )}

          {tool === "blur" && (
            <>
              <p className="hint my-0">{t.blurHint}</p>
              <Slider id="pe-brush" label={t.brushSize} value={brush} min={0.03} max={0.3} step={0.005}
                format={(v) => `${Math.round(v * 100)}%`} onChange={setBrush} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-ghost btn-sm" disabled={strokes === 0} onClick={undo}>
                  ↶ {t.undo}
                </button>
                <button type="button" className="btn-ghost btn-sm" disabled={strokes === 0} onClick={clearBlur}>
                  {t.clearBlur}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={applying}>
            {t.cancel}
          </button>
          <button type="button" className="btn-primary flex-1" onClick={apply} disabled={!src || !dirty || applying}>
            {applying ? t.applying : t.apply}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Slider({
  id, label, value, min, max, step, format, disabled, onChange,
}: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; disabled?: boolean; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
        <span className="text-xs tabular-nums text-faint">{format(value)}</span>
      </div>
      <input
        id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-brand-500"
      />
    </div>
  );
}

/** "Edit image" button + its popup. Used by the art editor and by each carousel photo. */
export function PhotoEditButton({
  photoUrl,
  frame,
  onApply,
  disabled,
  className = "btn-ghost btn-sm w-full",
}: {
  photoUrl: string;
  frame: EditFrame;
  onApply: (file: File) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}) {
  const { dict } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => setOpen(true)}>
        {dict.artEditor.photoEdit.open}
      </button>
      {open && (
        <PhotoEditModal
          photoUrl={photoUrl}
          frame={frame}
          onClose={() => setOpen(false)}
          onApply={onApply}
        />
      )}
    </>
  );
}
