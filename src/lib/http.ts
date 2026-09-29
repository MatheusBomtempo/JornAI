import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getLocale } from "./i18n/server";
import { translateApiMessage } from "./i18n/server-messages";

/** Translates an error message to the interface language of the current request. */
async function localize(message: string): Promise<string> {
  try {
    return translateApiMessage(message, await getLocale());
  } catch {
    return message; // outside a request scope there is no locale — keep English
  }
}

/** API error with an associated HTTP status. */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new ApiError(400, msg, details);
export const unauthorized = (msg = "Not authenticated") => new ApiError(401, msg);
export const forbidden = (msg = "Permission denied") => new ApiError(403, msg);
export const notFound = (msg = "Not found") => new ApiError(404, msg);
export const conflict = (msg: string) => new ApiError(409, msg);

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

/**
 * Converts any error thrown in a handler into a coherent JSON response. The
 * message is translated to the interface language of whoever made the request
 * (see i18n/server-messages.ts); the English text is the fallback.
 * Usage: `return handleError(err)` inside the catch of a route handler.
 */
export async function handleError(err: unknown): Promise<NextResponse> {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: await localize(err.message), details: err.details },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: await localize("Invalid data"), details: err.flatten() },
      { status: 400 },
    );
  }
  console.error("[JornAI] Unhandled error:", err);
  // Returns the real message (not just "internal error"): every route requires
  // login, and without this any production failure turns into a hunt through
  // the log in the Vercel dashboard — which truncates long messages exactly
  // when they matter (e.g. ffmpeg's stderr in the video render).
  return NextResponse.json(
    {
      error: await localize("Internal server error"),
      details: err instanceof Error ? err.message : String(err),
    },
    { status: 500 },
  );
}

/** Wraps a route handler with standardized error handling. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      return handleError(err);
    }
  };
}
