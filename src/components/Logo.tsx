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
    <span className={`inline-flex items-baseline gap-[0.3em] leading-none ${SIZES[size]}`}>
      <span className="font-masthead font-extrabold tracking-tight">Jorn</span>
      <span className="relative -top-[0.18em] rounded-[0.2em] bg-white px-[0.22em] py-[0.11em] font-sans text-[0.55em] font-extrabold tracking-tight text-black">
        AI
      </span>
    </span>
  );
}
