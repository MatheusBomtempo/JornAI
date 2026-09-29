"use client";

import { useEffect, useState } from "react";

/** Spinning icon — a visual sign of "still running", not stuck. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Counts the seconds since `active` became true — gives tangible feedback that
 * the call is progressing (and not stuck), without needing to open the
 * terminal to read any log. Free providers can take quite long (shared queue)
 * — this says so explicitly after a while.
 */
export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return seconds;
}

/** Button text with spinner + counter — use inside a <button>. */
export function BusyLabel({ label, seconds }: { label: string; seconds: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner />
      <span>
        {label}
        {seconds >= 4 && <span className="tabular-nums opacity-75"> · {seconds}s</span>}
      </span>
    </span>
  );
}
