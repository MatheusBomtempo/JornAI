import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { poppinsFile } from "@/lib/render/text";
import type { Weight } from "@/lib/render/text-svg";
import { notFound, route } from "@/lib/http";

const WEIGHTS = new Set<Weight>([400, 600, 700]);

// GET /api/fonts/poppins/:weight — the SAME .woff the server render uses, so
// the art editor lays out the text with the same metrics (see text-svg.ts).
// Public (Poppins is OFL) and with a long cache: the file only changes when
// the @fontsource package changes.
export const GET = route(async (_req: Request, ctx: { params: Promise<{ weight: string }> }) => {
  const weight = Number((await ctx.params).weight) as Weight;
  if (!WEIGHTS.has(weight)) throw notFound("Font weight not available.");
  const buf = await readFile(poppinsFile(weight));
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "font/woff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
