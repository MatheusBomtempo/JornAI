import "server-only";
import { env } from "../env";
import { ApiError, badRequest } from "../http";
import { getLanguagePack } from "../language";

/**
 * Built-in photo search in the "Image" step (see ImageSuggestions in
 * PostWorkspace) — Pexels is a royalty-free image library with a generous free
 * API (200 req/hour). It is not the real photo of the event (only Google
 * Images would find that, and it cannot be embedded/automated: the results
 * page blocks iframes and there is no equivalent free API) — it only serves as
 * a quick illustration, without leaving the site to download and re-upload.
 */
export interface PhotoSearchItem {
  id: number;
  thumbnailUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  photographer: string;
  photographerUrl: string;
  alt: string;
}

interface PexelsApiPhoto {
  id: number;
  width: number;
  height: number;
  alt?: string | null;
  photographer?: string;
  photographer_url?: string;
  src?: {
    original?: string;
    large2x?: string;
    large?: string;
    medium?: string;
    small?: string;
  };
}

const PER_PAGE = 15;
const FETCH_TIMEOUT_MS = 10_000;
/**
 * The searches come from the AI's suggestions — written in the content
 * language (APP_LANGUAGE), like the news. Without a locale Pexels reads the
 * query as English: "galpão em chamas" returned a fox photo; with pt-BR, 12 of
 * 15 results were about fires. The locale comes from the language pack.
 */

export function isPhotoSearchEnabled(): boolean {
  return Boolean(env.photoSearch.pexelsKey);
}

export async function searchPhotos(
  query: string,
  page: number,
): Promise<{ photos: PhotoSearchItem[]; nextPage: number | null }> {
  const key = env.photoSearch.pexelsKey;
  if (!key) {
    throw new ApiError(501, "Photo search is not configured (set PEXELS_API_KEY).");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${PER_PAGE}&page=${page}&locale=${getLanguagePack().photoSearchLocale}`,
      { headers: { Authorization: key }, signal: controller.signal, cache: "no-store" },
    );
  } catch (err) {
    const why =
      (err as Error).name === "AbortError" ? "timed out" : (err as Error).message;
    throw new ApiError(502, `Pexels did not answer (${why}).`);
  } finally {
    clearTimeout(timeout);
  }

  const body = (await res.json().catch(() => null)) as
    | { photos?: PexelsApiPhoto[]; next_page?: string }
    | null;
  if (!res.ok) {
    throw new ApiError(502, `Pexels refused the search (HTTP ${res.status}).`);
  }

  const photos: PhotoSearchItem[] = (body?.photos ?? [])
    .filter((p) => p.src?.medium || p.src?.small)
    .map((p) => ({
      id: p.id,
      thumbnailUrl: (p.src!.medium ?? p.src!.small) as string,
      downloadUrl: (p.src!.large2x ?? p.src!.large ?? p.src!.original ?? p.src!.medium) as string,
      width: p.width,
      height: p.height,
      photographer: p.photographer ?? "",
      photographerUrl: p.photographer_url ?? "",
      alt: p.alt || query,
    }));

  return { photos, nextPage: body?.next_page ? page + 1 : null };
}

// SSRF: this endpoint fetches a URL that comes from the CLIENT (the photo the
// person clicked in the picker) — without this check it would be a generic
// proxy to download any URL from the server. It only accepts Pexels subdomains
// (that is where the search's own "src.*" come from, e.g. images.pexels.com).
const ALLOWED_DOWNLOAD_HOST = /(^|\.)pexels\.com$/i;

export function assertPexelsDownloadUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest("Invalid image URL.");
  }
  if (url.protocol !== "https:" || !ALLOWED_DOWNLOAD_HOST.test(url.hostname)) {
    throw badRequest("Only images from images.pexels.com can be imported.");
  }
  return url;
}
