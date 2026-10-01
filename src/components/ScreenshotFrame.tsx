import Image, { type StaticImageData } from "next/image";

/** Browser-window frame around an app screenshot (landing and /about). */
export function ScreenshotFrame({
  image,
  alt,
  priority = false,
}: {
  image: StaticImageData;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(255,255,255,0.15)]">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
      </div>
      <Image
        src={image}
        alt={alt}
        priority={priority}
        sizes="(min-width: 1024px) 560px, 100vw"
        placeholder="blur"
        className="h-auto w-full"
      />
    </div>
  );
}
