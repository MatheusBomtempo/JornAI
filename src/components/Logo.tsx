const SIZES = {
  sm: { text: "text-xl", box: "text-[11px] px-1.5 py-0.5 rounded-md" },
  lg: { text: "text-4xl", box: "text-base px-2.5 py-1 rounded-xl" },
} as const;

/**
 * JornAI wordmark: "Jorn" in a newspaper-masthead serif, "AI" in bold sans
 * inside a rounded square. Black & white only.
 */
export function Logo({ size = "sm" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span className="inline-flex items-center gap-1.5 leading-none">
      <span className={`font-masthead font-extrabold tracking-tight ${s.text}`}>Jorn</span>
      <span className={`bg-white font-sans font-extrabold tracking-tight text-black ${s.box}`}>
        AI
      </span>
    </span>
  );
}
