import { type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { extractPdfText, extractPlainText } from "@/lib/pdf";
import { badRequest, ok, route } from "@/lib/http";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const PDF_TYPES = new Set(["application/pdf"]);
const TXT_TYPES = new Set(["text/plain", "text/markdown"]);

/**
 * POST /documents — receives a PDF (police report, official statement,
 * article) or .txt and returns the extracted text, which the reporter attaches
 * to the story as supporting material for the AI.
 *
 * The file is not stored: we only keep the text, together with the post.
 */
export const POST = route(async (req: NextRequest) => {
  await requireUser();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Missing 'file' field.");
  if (file.size > MAX_BYTES) throw badRequest("The file is larger than 20 MB.");

  const isPdf = PDF_TYPES.has(file.type) || file.name.toLowerCase().endsWith(".pdf");
  const isTxt = TXT_TYPES.has(file.type) || /\.(txt|md)$/i.test(file.name);
  if (!isPdf && !isTxt) {
    throw badRequest("Unsupported format. Send a PDF (or .txt).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = isPdf ? await extractPdfText(buffer) : extractPlainText(buffer);
  } catch (err) {
    throw badRequest((err as Error).message);
  }

  return ok({
    name: file.name,
    pages: result.pages,
    chars: result.text.length,
    truncated: result.truncated,
    text: result.text,
  });
});
