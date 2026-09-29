"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Spinner, useElapsedSeconds } from "./Spinner";
import { useLocale } from "./LocaleProvider";

/** Success stays on screen this long before closing by itself. */
const SUCCESS_AUTO_CLOSE_MS = 1800;
/** From here on it warns that it is taking longer than normal. */
const SLOW_AFTER_SECONDS = 8;

type Status = "loading" | "success" | "error";

interface LogEntry {
  id: number;
  /** ms since the start of this attempt. */
  at: number;
  text: string;
}

interface OverlayState {
  status: Status;
  /** What is being done — "Generating the text with AI…". */
  title: string;
  attempt: number;
  log: LogEntry[];
  /** Success message; null uses the dictionary default. */
  successMessage: string | null;
  /** If 0, it does not close by itself — waits for navigation or a tap. */
  successDelayMs: number;
  error: string | null;
  /** ms from the start until it finished (success or error) — timestamp of the last log line. */
  finishedAt: number | null;
  /** Progress bar (upload): fraction 0–1 and a detail such as "12.4 MB of 48 MB". */
  progress: { ratio: number; detail: string | null } | null;
  /** After how many seconds it shows the "taking longer than normal" warning. */
  slowAfterSeconds: number;
}

export interface RunContext {
  /** Records an intermediate step in the log ("Video on the server — generating the preview…"). */
  log: (text: string) => void;
  /**
   * Shows/updates the progress bar (fraction 0–1) with an optional detail;
   * `null` hides the bar (e.g. upload finished, server processing).
   */
  progress: (ratio: number | null, detail?: string) => void;
}

export interface RunOptions<T> {
  /** Title shown while it runs. Becomes the 1st line of the log. */
  title: string;
  /** Message when it works. Without it, "Done!". */
  success?: string;
  /**
   * How long the success stays on screen before closing by itself. 0 = does
   * not close by time (closes when the route changes or the person taps) —
   * useful when the action ends by navigating to another page.
   */
  successDelayMs?: number;
  /**
   * When to warn that it is taking long. Default SLOW_AFTER_SECONDS (8s) suits
   * text/art; a video render normally takes tens of seconds and, with the
   * default, it said "taking longer than normal — we are still trying" in the
   * middle of a healthy render.
   */
  slowAfterSeconds?: number;
  /** The action itself. Receives `log`/`progress` to detail the progress. */
  fn: (ctx: RunContext) => Promise<T>;
}

export type RunResult<T> = { ok: true; value: T } | { ok: false };

interface ActionOverlayContextValue {
  /**
   * Runs the action showing the modal. Only resolves when it really finishes:
   * `{ ok: true }` on success (including after "Try again") or `{ ok: false }`
   * if the person closed the error without trying again.
   */
  run: <T>(opts: RunOptions<T>) => Promise<RunResult<T>>;
  /** Closes the modal right away (only outside loading). */
  close: () => void;
}

const ActionOverlayContext = createContext<ActionOverlayContextValue | null>(null);

let logSeq = 0;

/**
 * Single feedback for every action that advances the flow (generate text,
 * generate art/video, approve, reject, rewrite): a full-screen modal with
 * loading + counter, a log of what happened and the result — success or the
 * whole error. It stays mounted in the root layout, so it survives the unmount
 * of the component that triggered it (the ArtEditor disappears when the post
 * goes to review) and navigation (CaptureForm → /posts/:id).
 *
 * Born for mobile: the spinner inside the button and the alert below it end up
 * out of view when the button is at the bottom of the page — the modal does not.
 */
export function ActionOverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OverlayState | null>(null);
  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // While the error is on screen, `run` waits for the person's decision.
  const decisionRef = useRef<((choice: "retry" | "close") => void) | null>(null);

  const clearTimer = () => {
    if (autoCloseTimer.current) {
      clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = null;
    }
  };

  const close = useCallback(() => {
    clearTimer();
    if (decisionRef.current) {
      // `run` is stopped at the error — it is the one that clears the state.
      decisionRef.current("close");
      return;
    }
    setState((s) => (s && s.status !== "loading" ? null : s));
  }, []);

  const retry = useCallback(() => {
    decisionRef.current?.("retry");
  }, []);

  const run = useCallback(async <T,>(opts: RunOptions<T>): Promise<RunResult<T>> => {
    const successDelayMs = opts.successDelayMs ?? SUCCESS_AUTO_CLOSE_MS;
    clearTimer();

    for (let attempt = 1; ; attempt++) {
      const startedAt = Date.now();
      const entry = (text: string): LogEntry => ({
        id: ++logSeq,
        at: Date.now() - startedAt,
        text,
      });
      const ctx: RunContext = {
        log: (text) => setState((s) => (s ? { ...s, log: [...s.log, entry(text)] } : s)),
        progress: (ratio, detail) =>
          setState((s) =>
            s
              ? {
                  ...s,
                  progress:
                    ratio === null
                      ? null
                      : { ratio: Math.min(1, Math.max(0, ratio)), detail: detail ?? null },
                }
              : s,
          ),
      };

      setState({
        status: "loading",
        title: opts.title,
        attempt,
        log: [entry(opts.title)],
        successMessage: opts.success ?? null,
        successDelayMs,
        error: null,
        finishedAt: null,
        progress: null,
        slowAfterSeconds: opts.slowAfterSeconds ?? SLOW_AFTER_SECONDS,
      });

      try {
        const value = await opts.fn(ctx);
        const finishedAt = Date.now() - startedAt;
        setState((s) => (s ? { ...s, status: "success", finishedAt, progress: null } : s));
        if (successDelayMs > 0) {
          autoCloseTimer.current = setTimeout(() => {
            autoCloseTimer.current = null;
            setState(null);
          }, successDelayMs);
        }
        return { ok: true, value };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const finishedAt = Date.now() - startedAt;
        setState((s) =>
          s ? { ...s, status: "error", error: message, finishedAt, progress: null } : s,
        );
        const choice = await new Promise<"retry" | "close">((resolve) => {
          decisionRef.current = resolve;
        });
        decisionRef.current = null;
        if (choice === "close") {
          setState(null);
          return { ok: false };
        }
      }
    }
  }, []);

  // Success that was waiting for navigation (successDelayMs = 0): the new page
  // arrived, it can close.
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    setState((s) => (s && s.status === "success" ? null : s));
  }, [pathname]);

  useEffect(() => clearTimer, []);

  const elapsed = useElapsedSeconds(state?.status === "loading");

  return (
    <ActionOverlayContext.Provider value={{ run, close }}>
      {children}
      {state && (
        <ActionOverlayDialog state={state} elapsed={elapsed} onClose={close} onRetry={retry} />
      )}
    </ActionOverlayContext.Provider>
  );
}

export function useActionOverlay(): ActionOverlayContextValue {
  const ctx = useContext(ActionOverlayContext);
  if (!ctx) throw new Error("useActionOverlay must be used within ActionOverlayProvider");
  return ctx;
}

// ── UI ────────────────────────────────────────────────────────

function ActionOverlayDialog({
  state,
  elapsed,
  onClose,
  onRetry,
}: {
  state: OverlayState;
  elapsed: number;
  onClose: () => void;
  onRetry: () => void;
}) {
  const { dict } = useLocale();
  const t = dict.actionOverlay;
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLLIElement>(null);
  const loading = state.status === "loading";

  // Locks the page scroll underneath — on mobile a finger easily slips to the
  // content behind and the person loses sight of the modal.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus: moves into the dialog on open (the screen reader announces it); when
  // it finishes, goes to the main button so it can be continued with just Enter.
  useEffect(() => {
    if (loading) dialogRef.current?.focus();
    else primaryRef.current?.focus();
  }, [loading]);

  // While it runs, it follows the new lines; when it finishes, it shows the
  // START of the result — on a long error (ffmpeg's stderr) the 1st line is the
  // one that explains, the rest is detail for whoever wants to scroll.
  useEffect(() => {
    if (state.status === "loading") logEndRef.current?.scrollIntoView({ block: "nearest" });
    else resultRef.current?.scrollIntoView({ block: "start" });
  }, [state.log.length, state.status]);

  useEffect(() => {
    if (loading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onClose]);

  const heading =
    state.status === "loading"
      ? state.title
      : state.status === "success"
        ? (state.successMessage ?? t.successDefault)
        : t.errorTitle;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4
                 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]
                 backdrop-blur-sm animate-fade-in"
      onClick={() => !loading && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-busy={loading}
        aria-live="assertive"
        aria-labelledby="action-overlay-title"
        aria-describedby="action-overlay-log"
        onClick={(e) => e.stopPropagation()}
        className={`card flex max-h-[min(85dvh,36rem)] w-full max-w-sm flex-col p-5 outline-none sm:p-6 ${
          state.status === "error"
            ? "border-red-500/40"
            : state.status === "success"
              ? "border-emerald-500/40"
              : "shadow-glow"
        }`}
      >
        {/* Header: big icon + what is happening */}
        <div className="flex flex-col items-center gap-3 text-center">
          <StatusIcon status={state.status} />
          <h2 id="action-overlay-title" className="text-base font-semibold leading-snug text-ink">
            {heading}
          </h2>
          {loading && (
            <p className="text-xs tabular-nums text-muted">{elapsed}s</p>
          )}
          {loading && state.progress && (
            <ProgressBar ratio={state.progress.ratio} detail={state.progress.detail} />
          )}
          {loading && elapsed >= state.slowAfterSeconds && (
            <p className="text-xs text-muted animate-fade-in">{t.slowHint}</p>
          )}
        </div>

        {/* Log — the only area that scrolls, to fit a long error (ffmpeg stderr) */}
        <div
          id="action-overlay-log"
          className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl border border-lineSoft bg-elevated p-3"
        >
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
            {t.logHeading}
            {state.attempt > 1 && <span> · {t.attempt.replace("{n}", String(state.attempt))}</span>}
          </p>
          <ol className="space-y-1 text-xs">
            {state.log.map((l) => (
              <li key={l.id} className="flex gap-2">
                <span className="shrink-0 tabular-nums text-faint">{formatAt(l.at)}</span>
                <span className="min-w-0 break-words text-muted">{l.text}</span>
              </li>
            ))}
            {state.status === "success" && (
              <li ref={resultRef} className="flex gap-2 text-emerald-300">
                <span className="shrink-0 tabular-nums text-faint">{formatAt(state.finishedAt ?? 0)}</span>
                <span aria-hidden className="shrink-0">✓</span>
                <span className="min-w-0 break-words">{state.successMessage ?? t.successDefault}</span>
              </li>
            )}
            {state.status === "error" && (
              <li ref={resultRef} className="flex gap-2 text-red-300">
                <span className="shrink-0 tabular-nums text-faint">{formatAt(state.finishedAt ?? 0)}</span>
                <span aria-hidden className="shrink-0">✕</span>
                <pre className="min-w-0 flex-1 select-text whitespace-pre-wrap break-words font-sans">
                  {state.error}
                </pre>
              </li>
            )}
          </ol>
          <div ref={logEndRef} />
        </div>

        {/* Actions */}
        {loading && state.progress ? (
          // Upload: the device is doing the work — leaving the app freezes/drops the
          // upload and it restarts from zero. In the server phase (no bar) the
          // generic warning is enough, the work carries on without the phone.
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200"
          >
            <span aria-hidden className="shrink-0">⚠️</span>
            <span>{t.uploadWarning}</span>
          </p>
        ) : loading ? (
          // No progress bar is the processing phase on the server (e.g. a video
          // render with ffmpeg) — it can take much longer than the upload, so the
          // warning has to be as visible as the one above.
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200"
          >
            <span aria-hidden className="shrink-0">⚠️</span>
            <span>{t.dontClose}</span>
          </p>
        ) : null}
        {state.status === "success" && (
          <button ref={primaryRef} type="button" className="btn-primary mt-4 w-full" onClick={onClose}>
            {t.continue}
          </button>
        )}
        {state.status === "error" && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t.close}
            </button>
            <button ref={primaryRef} type="button" className="btn-primary" onClick={onRetry}>
              {t.retry}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "loading") {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-500/30">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }
  if (status === "success") {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30 animate-fade-in">
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30 animate-fade-in">
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Upload bar — a percentage big enough to read on a phone without glasses. */
function ProgressBar({ ratio, detail }: { ratio: number; detail: string | null }) {
  const pct = Math.round(ratio * 100);
  return (
    <div
      className="w-full"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-muted">
        <span className="font-semibold text-ink">{pct}%</span>
        {detail && <span> · {detail}</span>}
      </p>
    </div>
  );
}

function formatAt(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
