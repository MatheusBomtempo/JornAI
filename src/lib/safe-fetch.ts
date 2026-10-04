import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Server-side fetch of a URL that came from the CLIENT (e.g. the link pasted
 * in a story). Without these checks the server becomes a proxy into its own
 * network: anyone logged in could make it read http://169.254.169.254 (cloud
 * metadata), localhost services or anything else on the private network.
 *
 *  - only http/https;
 *  - the host must resolve to public addresses only;
 *  - redirects are followed by hand, re-checking every hop;
 *  - timeout and a body size cap.
 *
 * Known gap: the address is checked before fetch() resolves the host again
 * (DNS rebinding). Closing it needs a custom dispatcher; this already blocks
 * the direct cases.
 */

const MAX_REDIRECTS = 5;

export class UnsafeUrlError extends Error {
  constructor(message = "This link points to an address that cannot be accessed.") {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast + reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::" || v === "::1") return true;
  // IPv4-mapped, in both the dotted and the hex form (::ffff:7f00:1).
  const dotted = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isPrivateIPv4(dotted[1]);
  const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return /^(fc|fd|fe[89ab]|ff)/.test(v); // unique-local, link-local, multicast
}

function isPrivateAddress(ip: string): boolean {
  return isIP(ip) === 4 ? isPrivateIPv4(ip) : isPrivateIPv6(ip);
}

/** Throws UnsafeUrlError unless the URL is http(s) and its host resolves only to public addresses. */
export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https links are supported.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) throw new UnsafeUrlError();

  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new UnsafeUrlError("Could not find the site of this link.");
    }
  }
  if (!addresses.length || addresses.some(isPrivateAddress)) throw new UnsafeUrlError();
  return url;
}

/** fetch() for client-supplied URLs — see the file header. */
export async function safeFetch(
  raw: string,
  init: Omit<RequestInit, "redirect" | "signal"> = {},
  { timeoutMs = 15_000 }: { timeoutMs?: number } = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let url = await assertPublicUrl(raw);
    for (let hop = 0; ; hop++) {
      const res = await fetch(url, { ...init, redirect: "manual", signal: controller.signal });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !location) return res;
      if (hop >= MAX_REDIRECTS) throw new Error("Too many redirects.");
      url = await assertPublicUrl(new URL(location, url));
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error("The site took too long to answer.");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/** Reads the body as text, giving up past `maxBytes` (a link can point at a huge file). */
export async function readTextLimited(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("The page is too large to read.");
  if (!res.body) return "";

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("The page is too large to read.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
