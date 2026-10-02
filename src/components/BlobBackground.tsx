/**
 * Neon-style blurred blobs for the public pages, in the black & white palette:
 * big white/gray glows that drift slowly behind the content. Purely decorative
 * (aria-hidden, no pointer events) — the parent must be `relative overflow-hidden`.
 * No CSS blur filter (the radial gradients are already soft; a filter on animated
 * layers is costly to repaint), and motion-safe: so people who ask for reduced motion
 * get still blobs. The global reduced-motion rule squeezes durations to 0.01ms, which
 * on an infinite animation would make them flash.
 */
const BLOBS: { className: string; style: React.CSSProperties; anim: string }[] = [
  {
    className: "-left-40 top-[2%] h-[520px] w-[520px]",
    style: { background: "radial-gradient(circle, rgba(255,255,255,.38), transparent 66%)" },
    anim: "motion-safe:animate-blob",
  },
  {
    className: "-right-48 top-[9%] h-[620px] w-[620px]",
    style: { background: "radial-gradient(circle, rgba(255,255,255,.26), transparent 66%)" },
    anim: "motion-safe:animate-blob-slow",
  },
  {
    className: "-left-52 top-[34%] h-[640px] w-[640px]",
    style: { background: "radial-gradient(circle, rgba(212,212,212,.28), transparent 66%)" },
    anim: "motion-safe:animate-blob-slow",
  },
  {
    className: "-right-40 top-[58%] h-[560px] w-[560px]",
    style: { background: "radial-gradient(circle, rgba(255,255,255,.32), transparent 66%)" },
    anim: "motion-safe:animate-blob",
  },
  {
    className: "-left-44 top-[82%] h-[600px] w-[600px]",
    style: { background: "radial-gradient(circle, rgba(190,190,190,.3), transparent 66%)" },
    anim: "motion-safe:animate-blob-slow",
  },
];

export function BlobBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className={`absolute rounded-full will-change-transform ${b.className} ${b.anim}`}
          style={b.style}
        />
      ))}
    </div>
  );
}
