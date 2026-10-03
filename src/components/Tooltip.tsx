"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "./LocaleProvider";

interface Props {
  /** Texto explicativo. */
  text: string;
  /** Where the field shows up in the final product (optional, highlighted). */
  where?: string;
  /** Which edge of the "?" the popover lines up with — "right" for icons near the right edge of the screen. */
  align?: "left" | "right";
}

/**
 * "?" icon that reveals an explanation. Works on hover (desktop) and on touch
 * (mobile) — hence click + hover, not just hover.
 */
export function Tooltip({ text, where, align = "left" }: Props) {
  const { dict } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <span ref={ref} className="group relative inline-flex">
      <button
        type="button"
        aria-label={dict.tooltip.ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-line
                   bg-elevated text-[11px] font-bold text-muted transition-colors
                   hover:border-brand-500/60 hover:text-brand-300"
      >
        ?
      </button>

      {/* Opened by click (mobile) or by hover (desktop) */}
      <span
        role="tooltip"
        className={`absolute ${align === "right" ? "right-0" : "left-0"} top-7 z-40 w-64 max-w-[calc(100vw-2.5rem)] animate-fade-in
                    rounded-xl border border-line bg-elevated p-3 text-left shadow-soft
                    sm:w-72 ${open ? "block" : "hidden group-hover:block"}`}
      >
        <span className="block text-xs font-normal leading-relaxed text-ink">
          {text}
        </span>
        {where && (
          <span className="mt-2 block rounded-lg bg-brand-500/10 px-2 py-1 text-[11px] font-medium leading-relaxed text-brand-200">
            📍 {where}
          </span>
        )}
      </span>
    </span>
  );
}
