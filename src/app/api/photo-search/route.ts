import { type NextRequest } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { isPhotoSearchEnabled, searchPhotos } from "@/lib/services/photo-search";
import { badRequest, ok, route } from "@/lib/http";

// GET /photo-search?q=&page= — built-in Pexels search to attach a photo without
// leaving the site (see ImageSuggestions/PhotoPickerModal in PostWorkspace).
// Without PEXELS_API_KEY configured, it returns enabled:false (the button falls
// back to opening the search in a new tab, as before).
export const GET = route(async (req: NextRequest) => {
  await requireCompanyUser();
  if (!isPhotoSearchEnabled()) return ok({ enabled: false as const });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) throw badRequest("Missing 'q' parameter.");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const { photos, nextPage } = await searchPhotos(q, page);
  return ok({ enabled: true as const, photos, nextPage });
});
