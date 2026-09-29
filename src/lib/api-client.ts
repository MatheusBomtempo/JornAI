"use client";

import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";

/** Messages in the language the interface is currently showing. */
function text() {
  const lang = document.documentElement.lang.slice(0, 2);
  return getDictionary(isLocale(lang) ? lang : "en").apiClient;
}

/** Fetch wrapper for the client components. Throws with the API message. */
export async function api<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  const isJson = res.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message =
      (data as { error?: string })?.error ?? `${text().httpError} ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export const apiGet = <T>(path: string) => api<T>(path);

export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, {
    method: "POST",
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  });

export const apiPatch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });

export const apiPut = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) });

export const apiDelete = <T>(path: string) =>
  api<T>(path, { method: "DELETE" });

export type UploadProgress = (sentBytes: number, totalBytes: number) => void;

/**
 * File upload with progress. `fetch` does not expose upload progress;
 * XMLHttpRequest does — and for a 100 MB video going to a server on another
 * continent it is the difference between "did it hang?" and "30% left". Same
 * error contract as `api()`: throws with the API message (or the <Message> of
 * the XML that S3/R2 return when the signed URL is refused).
 */
export function uploadWithProgress<T = unknown>(
  url: string,
  init: { method: "POST" | "PUT"; body: FormData | Blob; headers?: Record<string, string> },
  onProgress?: UploadProgress,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method, url);
    for (const [name, value] of Object.entries(init.headers ?? {})) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    };
    xhr.onerror = () => reject(new Error(text().uploadNetworkError));
    xhr.onabort = () => reject(new Error(text().uploadAborted));
    xhr.ontimeout = () => reject(new Error(text().uploadTimeout));
    xhr.onload = () => {
      const type = xhr.getResponseHeader("content-type") ?? "";
      let data: unknown = null;
      if (type.includes("application/json")) {
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = null;
        }
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const xmlMessage = type.includes("xml")
          ? /<Message>([\s\S]*?)<\/Message>/.exec(xhr.responseText)?.[1]
          : undefined;
        const message =
          (data as { error?: string })?.error ?? xmlMessage ?? `${text().httpError} ${xhr.status}`;
        reject(new Error(message));
        return;
      }
      resolve(data as T);
    };
    xhr.send(init.body);
  });
}
