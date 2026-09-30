const SIZES = {
  sm: "text-xl",
  lg: "text-4xl",
} as const;

/**
 * JornAI wordmark: "Jorn" in a newspaper-masthead serif, "AI" in bold sans
 * inside a rounded square. Black & white only. Everything is sized in `em`
 * so the two halves stay proportional at any size.
 */
export function Logo({ size = "sm" }: { size?: keyof typeof SIZES }) {
  return (
    <span className={`inline-flex items-center gap-[0.3em] leading-none ${SIZES[size]}`}>
      <span className="font-masthead font-extrabold tracking-tight">Jorn</span>
      <span className="rounded-[0.28em] bg-white px-[0.3em] py-[0.16em] font-sans text-[0.8em] font-extrabold tracking-tight text-black">
        AI
      </span>
    </span>
  );
}
