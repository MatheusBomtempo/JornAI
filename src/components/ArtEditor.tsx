"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { apiPost } from "@/lib/api-client";
import { type TextTransform } from "@/lib/text-case";
import { textSlotSchema, type TextSlot } from "@/lib/render/slots";
import { layoutText, type Font, type Weight } from "@/lib/render/text-svg";
import { useLocale } from "./LocaleProvider";
import { useActionOverlay } from "./ActionOverlay";
import { PhotoEditButton, canvasUrl } from "./PhotoEditModal";
import type { CarouselSlide } from "@/lib/carousel";

interface Slot {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  weight?: number;
  lineHeight?: number;
  transform?: TextTransform;
  [k: string]: unknown;
}

export interface EditorTemplate {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  overlayAssetUrl: string;
  photoSlot: Slot;
  titleSlot: Slot;
  subtitleSlot: Slot | null;
}

export interface EditorPhoto {
  id: string;
  storageUrl: string;
}

type Offset = { offsetX: number; offsetY: number };
type TextKind = "title" | "subtitle";

// ── Text identical to the final art ──────────────────────────
// The editor's title/subtitle uses the SAME vector layout as the server render
// (layoutText, in render/text-svg.ts) with the SAME Poppins file (served by
// /api/fonts/poppins/[weight]). Before it was a Fabric Textbox: its own metrics
// and no font shrinking — a long title wrapped to 3 lines and touched the
// subtitle, while the review art (which shrinks to fit the slot) came out
// normal.

const fontPromises = new Map<Weight, Promise<Font | null>>();
const loadedFonts = new Map<Weight, Font>();

function loadEditorFont(weight: Weight): Promise<Font | null> {
  let p = fontPromises.get(weight);
  if (!p) {
    p = (async () => {
      try {
        const [mod, res] = await Promise.all([
          import("opentype.js"),
          fetch(`/api/fonts/poppins/${weight}`),
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // opentype.js is CommonJS: the bundler may deliver it in `default` or not.
        const parse = (mod.default ?? mod).parse as (buf: ArrayBuffer) => Font;
        const font = parse(await res.arrayBuffer());
        loadedFonts.set(weight, font);
        return font;
      } catch (err) {
        console.warn(`[JornAI] Poppins font ${weight} did not load in the editor:`, err);
        fontPromises.delete(weight); // tries again on the next mount
        return null;
      }
    })();
    fontPromises.set(weight, p);
  }
  return p;
}

/**
 * Draggable box of the EXACT size of the slot (same geometry the render uses to
 * position and clamp the text — see offsetSlot), which draws inside it the
 * glyphs computed by layoutText.
 */
function makeTextHandle(
  fabric: typeof import("fabric"),
  slot: TextSlot,
  dispScale: number,
  offset: Offset,
  borderColor: string,
) {
  const handle: any = new fabric.Rect({
    left: (slot.x + offset.offsetX) * dispScale,
    top: (slot.y + offset.offsetY) * dispScale,
    width: slot.width * dispScale,
    height: slot.height * dispScale,
    fill: "rgba(0,0,0,0)",
    stroke: null,
    strokeWidth: 0,
    selectable: true,
    evented: true,
    hasControls: false,
    hasBorders: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    borderColor,
    // No cache: Fabric's cache crops to the box size, and the descenders of the
    // last line (g, p, ç) may go slightly past the slot — just like in the final art.
    objectCaching: false,
  });
  handle.jornaiText = { glyphs: [] as { path: Path2D; x: number; y: number }[], slot, dispScale, fallback: "" };
  handle._render = (ctx: CanvasRenderingContext2D) => {
    const t = handle.jornaiText;
    ctx.save();
    ctx.translate(-handle.width / 2, -handle.height / 2);
    ctx.scale(t.dispScale, t.dispScale);
    ctx.fillStyle = t.slot.color;
    if (t.glyphs.length) {
      for (const g of t.glyphs) {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.fill(g.path);
        ctx.restore();
      }
    } else if (t.fallback) {
      // Only if the font did not load: shows approximate text instead of nothing.
      ctx.font = `${t.slot.weight} ${t.slot.fontSize}px Poppins`;
      ctx.textBaseline = "top";
      ctx.fillText(t.fallback, 0, 0, t.slot.width);
    }
    ctx.restore();
  };
  return handle;
}

/** (Re)calcula os glifos do texto — layout relativo ao canto do slot. */
function setHandleText(handle: any, text: string) {
  if (!handle) return;
  const t = handle.jornaiText;
  const font = loadedFonts.get(t.slot.weight as Weight);
  const layout = font ? layoutText(font, text, { ...t.slot, x: 0, y: 0 }) : null;
  t.glyphs = (layout?.glyphs ?? []).map((g) => ({ path: new Path2D(g.d), x: g.x, y: g.y }));
  t.fallback = font ? "" : text;
  handle.dirty = true;
}

interface Props {
  postId: string;
  photos: EditorPhoto[];
  templates: EditorTemplate[];
  initial?: {
    selectedPhotoId?: string | null;
    artTemplateId?: string | null;
    photoTransform?: { offsetX: number; offsetY: number; scale: number } | null;
    title?: string | null;
    subtitle?: string | null;
    titleOffset?: Offset | null;
    subtitleOffset?: Offset | null;
  };
  onSaved?: () => void;
  /**
   * Carousel photos 2..N (the cover is this editor's photo). Sent with the
   * save; undefined/empty = single-image post.
   */
  carouselSlides?: CarouselSlide[];
  /**
   * Carousel strip, rendered under the editor with the active template's size
   * (`canvas`) and the size of its photo slot (`cover`: where photo 1 ends up).
   */
  renderCarousel?: (
    canvas: { width: number; height: number },
    cover: { width: number; height: number },
  ) => ReactNode;
  /**
   * Receives the photo edited in the "Edit image" popup (already cropped to the
   * slot's proportion). The workspace attaches it as a new photo and selects it.
   */
  onEditPhoto?: (file: File) => void | Promise<void>;
  /** Tells the workspace what is typed/chosen, so a remount (new photo) does not lose it. */
  onDraft?: (draft: { templateId: string; title: string; subtitle: string }) => void;
}

type Transform = { offsetX: number; offsetY: number; scale: number };
const ZERO_OFFSET: Offset = { offsetX: 0, offsetY: 0 };

export const TITLE_MAX = 69;
export const SUBTITLE_MAX = 149;

export function ArtEditor({
  postId,
  photos,
  templates,
  initial,
  onSaved,
  carouselSlides,
  renderCarousel,
  onEditPhoto,
  onDraft,
}: Props) {
  const { dict } = useLocale();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const fx = useRef<{
    canvas: any;
    image: any;
    titleBox: any;
    subtitleBox: any;
    dispScale: number;
    coverScaleDisp: number;
    slot: { x: number; y: number; w: number; h: number };
    nW: number;
    nH: number;
  } | null>(null);

  // Refs persist the adjustment across canvas rebuilds (photo/template switch).
  const transformRef = useRef<Transform>(
    initial?.photoTransform ?? { offsetX: 0, offsetY: 0, scale: 1 },
  );
  const titleOffsetRef = useRef<Offset>(initial?.titleOffset ?? ZERO_OFFSET);
  const subtitleOffsetRef = useRef<Offset>(initial?.subtitleOffset ?? ZERO_OFFSET);

  const [displayW, setDisplayW] = useState(0);
  const [photoId, setPhotoId] = useState(
    initial?.selectedPhotoId ?? photos[0]?.id ?? "",
  );
  const [templateId, setTemplateId] = useState(
    initial?.artTemplateId ?? templates[0]?.id ?? "",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [zoom, setZoom] = useState(transformRef.current.scale);
  const [textMoved, setTextMoved] = useState(
    hasOffset(titleOffsetRef.current) || hasOffset(subtitleOffsetRef.current),
  );
  const [saving, setSaving] = useState(false);
  const { run } = useActionOverlay();

  const template = templates.find((t) => t.id === templateId);
  const photo = photos.find((p) => p.id === photoId) ?? photos[0];

  useEffect(() => {
    onDraft?.({ templateId, title, subtitle });
  }, [onDraft, templateId, title, subtitle]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const w = Math.floor(el.clientWidth);
      setDisplayW((prev) => (Math.abs(prev - w) > 8 ? w : prev));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clamp = useCallback(() => {
    const r = fx.current;
    if (!r) return;
    const img = r.image;
    if (img.scaleX < r.coverScaleDisp) {
      img.set({ scaleX: r.coverScaleDisp, scaleY: r.coverScaleDisp });
    }
    if (img.scaleY !== img.scaleX) img.set({ scaleY: img.scaleX });

    const w = r.nW * img.scaleX;
    const h = r.nH * img.scaleX;
    img.set({
      left: Math.min(r.slot.x, Math.max(r.slot.x + r.slot.w - w, img.left)),
      top: Math.min(r.slot.y, Math.max(r.slot.y + r.slot.h - h, img.top)),
    });
    img.setCoords();
  }, []);

  const readTransform = useCallback((): Transform => {
    const r = fx.current;
    if (!r) return transformRef.current;
    const img = r.image;
    const w = r.nW * img.scaleX;
    const h = r.nH * img.scaleX;
    return {
      offsetX: (img.left - r.slot.x - (r.slot.w - w) / 2) / r.dispScale,
      offsetY: (img.top - r.slot.y - (r.slot.h - h) / 2) / r.dispScale,
      scale: img.scaleX / r.coverScaleDisp,
    };
  }, []);

  /** Clamps the text box inside the canvas — same rule as the final render (offsetSlot). */
  const clampTextBox = useCallback((box: any, slotDef: Slot) => {
    const r = fx.current;
    if (!r || !box) return;
    const maxLeft = Math.max(0, displayW - slotDef.width * r.dispScale);
    const maxTop = Math.max(
      0,
      (template?.canvasHeight ?? 0) * r.dispScale - slotDef.height * r.dispScale,
    );
    box.set({
      left: Math.min(maxLeft, Math.max(0, box.left)),
      top: Math.min(maxTop, Math.max(0, box.top)),
    });
    box.setCoords();
  }, [displayW, template]);

  /** Reads the current offset of a text relative to the template's default position. */
  const readTextOffset = useCallback(
    (kind: TextKind): Offset => {
      const r = fx.current;
      const box = kind === "title" ? r?.titleBox : r?.subtitleBox;
      const slotDef = kind === "title" ? template?.titleSlot : template?.subtitleSlot;
      if (!r || !box || !slotDef) {
        return kind === "title" ? titleOffsetRef.current : subtitleOffsetRef.current;
      }
      return {
        offsetX: (box.left - slotDef.x * r.dispScale) / r.dispScale,
        offsetY: (box.top - slotDef.y * r.dispScale) / r.dispScale,
      };
    },
    [template],
  );

  // (Re)builds the canvas
  useEffect(() => {
    if (!canvasEl.current || !template || !photo || displayW <= 0) return;
    let dead = false;

    (async () => {
      // Slots with the same defaults as the server render (weight, line height…).
      const titleSlot = textSlotSchema.parse(template.titleSlot);
      const subtitleSlot = template.subtitleSlot ? textSlotSchema.parse(template.subtitleSlot) : null;
      const [fabric] = await Promise.all([
        import("fabric"),
        loadEditorFont(titleSlot.weight as Weight),
        subtitleSlot ? loadEditorFont(subtitleSlot.weight as Weight) : null,
      ]);
      if (dead) return;

      const dispScale = displayW / template.canvasWidth;
      const displayH = template.canvasHeight * dispScale;

      fx.current?.canvas?.dispose?.();

      const canvas = new fabric.Canvas(canvasEl.current!, {
        width: displayW,
        height: displayH,
        backgroundColor: "#000",
        selection: false,
        preserveObjectStacking: true,
        uniformScaling: true,
        uniScaleKey: null,
      });

      const ps = template.photoSlot;
      const slot = {
        x: ps.x * dispScale,
        y: ps.y * dispScale,
        w: ps.width * dispScale,
        h: ps.height * dispScale,
      };

      const img = await fabric.FabricImage.fromURL(canvasUrl(photo.storageUrl), {
        crossOrigin: "anonymous",
      });
      const nW = img.width ?? 1;
      const nH = img.height ?? 1;
      const coverScaleDisp = Math.max(slot.w / nW, slot.h / nH);

      const t = transformRef.current;
      const s = coverScaleDisp * Math.max(1, t.scale || 1);
      img.set({
        scaleX: s,
        scaleY: s,
        left: slot.x + (slot.w - nW * s) / 2 + (t.offsetX || 0) * dispScale,
        top: slot.y + (slot.h - nH * s) / 2 + (t.offsetY || 0) * dispScale,
        hasControls: true,
        hasBorders: true,
        lockRotation: true,
        lockSkewingX: true,
        lockSkewingY: true,
        cornerColor: "#ffffff",
        cornerStrokeColor: "#fff",
        cornerSize: 14,
        transparentCorners: false,
        borderColor: "#ffffff",
      });
      img.setControlsVisibility({
        ml: false, mr: false, mt: false, mb: false, mtr: false,
      });
      img.clipPath = new fabric.Rect({
        left: slot.x, top: slot.y, width: slot.w, height: slot.h,
        absolutePositioned: true,
      });
      canvas.add(img);

      // If the frame fails for any other reason, the editor carries on without it
      // instead of aborting here — before, the title and subtitle (added right
      // below) also vanished and there was nothing to drag.
      try {
        const overlay = await fabric.FabricImage.fromURL(canvasUrl(template.overlayAssetUrl), {
          crossOrigin: "anonymous",
        });
        overlay.set({
          left: 0, top: 0,
          scaleX: displayW / (overlay.width ?? displayW),
          scaleY: displayH / (overlay.height ?? displayH),
          selectable: false, evented: false,
        });
        canvas.add(overlay);
      } catch (err) {
        console.warn("[JornAI] Template frame did not load in the editor:", err);
      }

      // Draggable text — only MOVES (no resizing/rotating, to keep the template's
      // font and width). The offset is saved per post; the template itself never
      // changes. Drawn with the final art layout — see makeTextHandle.
      const titleBox = makeTextHandle(fabric, titleSlot, dispScale, titleOffsetRef.current, "#f59e0b");
      setHandleText(titleBox, title);
      canvas.add(titleBox);

      let subtitleBox = null;
      if (subtitleSlot) {
        subtitleBox = makeTextHandle(fabric, subtitleSlot, dispScale, subtitleOffsetRef.current, "#10b981");
        setHandleText(subtitleBox, subtitle);
        canvas.add(subtitleBox);
      }

      fx.current = {
        canvas, image: img, titleBox, subtitleBox,
        dispScale, coverScaleDisp, slot, nW, nH,
      };
      clamp();
      canvas.renderAll();

      const sync = (e?: { target?: any }) => {
        const target = e?.target;
        if (!target || target === img) {
          clamp();
          transformRef.current = readTransform();
          setZoom(transformRef.current.scale);
        }
        if (target === titleBox) {
          clampTextBox(titleBox, template.titleSlot);
          titleOffsetRef.current = readTextOffset("title");
          setTextMoved(hasOffset(titleOffsetRef.current) || hasOffset(subtitleOffsetRef.current));
        }
        if (target === subtitleBox && template.subtitleSlot) {
          clampTextBox(subtitleBox, template.subtitleSlot);
          subtitleOffsetRef.current = readTextOffset("subtitle");
          setTextMoved(hasOffset(titleOffsetRef.current) || hasOffset(subtitleOffsetRef.current));
        }
        canvas.renderAll();
      };
      canvas.on("object:moving", sync);
      canvas.on("object:scaling", sync);
      canvas.on("object:modified", sync);
    })();

    return () => {
      dead = true;
      fx.current?.canvas?.dispose?.();
      fx.current = null;
    };
    // photo?.id, not photoId: a photo just uploaded (e.g. a carousel cover
    // swapped for its blurred copy) is only in `photos` after the refresh —
    // until then `photo` falls back to photos[0], and the canvas must redraw
    // once the real one arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, templateId, displayW]);

  // Live text in the preview (same layout as the final art, including the
  // shrink/"…" when it does not fit the slot).
  useEffect(() => {
    const r = fx.current;
    if (r?.titleBox) {
      setHandleText(r.titleBox, title);
      r.canvas.renderAll();
    }
  }, [title]);

  useEffect(() => {
    const r = fx.current;
    if (r?.subtitleBox) {
      setHandleText(r.subtitleBox, subtitle);
      r.canvas.renderAll();
    }
  }, [subtitle]);

  function applyZoom(next: number) {
    const r = fx.current;
    setZoom(next);
    if (!r) return;
    const img = r.image;
    const cx = r.slot.x + r.slot.w / 2;
    const cy = r.slot.y + r.slot.h / 2;
    const relX = (cx - img.left) / (r.nW * img.scaleX);
    const relY = (cy - img.top) / (r.nH * img.scaleX);
    const s = r.coverScaleDisp * next;
    img.set({
      scaleX: s, scaleY: s,
      left: cx - relX * r.nW * s,
      top: cy - relY * r.nH * s,
    });
    clamp();
    transformRef.current = readTransform();
    r.canvas.renderAll();
  }

  /** Puts the title or subtitle back at the template's default position. */
  function resetTextPosition(kind: TextKind) {
    const r = fx.current;
    const slotDef = kind === "title" ? template?.titleSlot : template?.subtitleSlot;
    const box = kind === "title" ? r?.titleBox : r?.subtitleBox;
    if (kind === "title") titleOffsetRef.current = ZERO_OFFSET;
    else subtitleOffsetRef.current = ZERO_OFFSET;
    if (r && box && slotDef) {
      box.set({ left: slotDef.x * r.dispScale, top: slotDef.y * r.dispScale });
      box.setCoords();
      r.canvas.renderAll();
    }
    setTextMoved(hasOffset(titleOffsetRef.current) || hasOffset(subtitleOffsetRef.current));
  }

  const isCarousel = (carouselSlides?.length ?? 0) > 0;

  async function save() {
    if (!template || !photo) return;
    setSaving(true);
    // Loading/error/success go to the modal (ActionOverlay) — it survives this
    // editor's unmount when the post moves on to review.
    const result = await run({
      title: isCarousel ? dict.carousel.savingButton : dict.artEditor.savingButton,
      success: isCarousel ? dict.carousel.doneMessage : dict.artEditor.doneMessage,
      fn: () =>
        apiPost(`/api/posts/${postId}/art`, {
          selectedPhotoId: photo.id,
          artTemplateId: template.id,
          photoTransform: readTransform(),
          title: title.slice(0, TITLE_MAX),
          subtitle: subtitle.slice(0, SUBTITLE_MAX),
          titleOffset: readTextOffset("title"),
          subtitleOffset: readTextOffset("subtitle"),
          carouselSlides: carouselSlides ?? [],
        }),
    });
    setSaving(false);
    if (result.ok) onSaved?.();
  }

  return (
    <div className="space-y-4">
      <div ref={wrapRef} className="mx-auto w-full max-w-[420px]">
        <canvas ref={canvasEl} className="w-full touch-none rounded-xl border border-line" />
      </div>
      <p className="text-center text-xs text-muted">
        {dict.artEditor.helper.dragPhoto}{" "}
        <span className="text-amber-400">{dict.artEditor.helper.titleWord}</span>{" "}
        {dict.artEditor.helper.orSubtitle}{" "}
        <span className="text-emerald-400">{dict.artEditor.helper.subtitleWord}</span>{" "}
        {dict.artEditor.helper.suffix}
      </p>

      {!isCarousel && template && photo && onEditPhoto && (
        <PhotoEditButton
          photoUrl={photo.storageUrl}
          frame={{ width: template.photoSlot.width, height: template.photoSlot.height }}
          onApply={onEditPhoto}
        />
      )}

      <div className="card-soft p-3">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="zoom" className="text-xs font-medium text-muted">{dict.artEditor.zoomLabel}</label>
          <span className="text-xs tabular-nums text-faint">{zoom.toFixed(2)}×</span>
        </div>
        <input
          id="zoom" type="range" min={1} max={3} step={0.01} value={zoom}
          onChange={(e) => applyZoom(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-brand-500"
        />
      </div>

      {template &&
        renderCarousel?.(
          { width: template.canvasWidth, height: template.canvasHeight },
          { width: template.photoSlot.width, height: template.photoSlot.height },
        )}

      {textMoved && (
        <button type="button" className="btn-ghost btn-sm w-full" onClick={() => {
          resetTextPosition("title");
          resetTextPosition("subtitle");
        }}>
          {dict.artEditor.resetTextPosition}
        </button>
      )}

      <CharField
        id="art-title" label={dict.artEditor.titleFieldLabel} max={TITLE_MAX}
        value={title} onChange={setTitle}
        placeholder={dict.artEditor.titleFieldPlaceholder}
      />

      {template?.subtitleSlot && (
        <CharField
          id="art-subtitle" label={dict.artEditor.subtitleFieldLabel} max={SUBTITLE_MAX}
          value={subtitle} onChange={setSubtitle} rows={2}
          placeholder={dict.artEditor.subtitleFieldPlaceholder}
        />
      )}

      {templates.length > 1 && (
        <div>
          <label className="label">{dict.artEditor.formatLabel}</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {templates.map((t) => {
              const active = t.id === templateId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  aria-pressed={active}
                  className={`group relative overflow-hidden rounded-xl border-2 bg-black text-left transition-all ${
                    active
                      ? "border-brand-500 ring-2 ring-brand-500/40"
                      : "border-line hover:border-brand-500/50"
                  }`}
                >
                  <div
                    className="w-full bg-elevated"
                    style={{ aspectRatio: `${t.canvasWidth} / ${t.canvasHeight}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.overlayAssetUrl}
                      alt={t.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div
                    className={`truncate px-1.5 py-1.5 text-center text-[11px] font-medium leading-tight ${
                      active ? "text-brand-300" : "text-muted"
                    }`}
                  >
                    {t.name}
                  </div>
                  {active && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] text-black">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={save} className="btn-primary w-full" disabled={saving}>
        {saving
          ? isCarousel
            ? dict.carousel.savingButton
            : dict.artEditor.savingButton
          : isCarousel
            ? dict.carousel.saveButton.replace("{count}", String((carouselSlides?.length ?? 0) + 1))
            : dict.artEditor.saveButton}
      </button>
    </div>
  );
}

function hasOffset(o: Offset): boolean {
  return Math.abs(o.offsetX) > 0.5 || Math.abs(o.offsetY) > 0.5;
}

function CharField({
  id, label, value, onChange, max, rows = 2, placeholder,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; max: number;
  rows?: number; placeholder?: string;
}) {
  const over = value.length > max;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label" htmlFor={id}>{label}</label>
        <span className={`text-xs tabular-nums ${over ? "text-red-400" : "text-faint"}`}>
          {value.length}/{max}
        </span>
      </div>
      <textarea
        id={id}
        className={`input resize-y font-art ${over ? "border-red-500/60" : ""}`}
        rows={rows}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
