"use client";

import { type PostStatus } from "@/lib/domain";
import { useLocale } from "./LocaleProvider";

const COLORS: Record<string, string> = {
  processing_ai: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/25",
  editing_art: "bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-500/25",
  in_review: "bg-white/10 text-neutral-200 ring-1 ring-inset ring-white/20",
  approved: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/25",
  publishing: "bg-cyan-500/15 text-cyan-300 ring-1 ring-inset ring-cyan-500/25",
  published: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/40",
  rejected: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/25",
  failed: "bg-red-500/20 text-red-200 ring-1 ring-inset ring-red-500/40",
};

export function StatusBadge({ status }: { status: string }) {
  const { dict } = useLocale();
  const label = dict.common.status[status as PostStatus] ?? status;
  const color = COLORS[status] ?? "bg-line text-muted";
  return (
    <span className={`badge gap-1.5 ${color}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
