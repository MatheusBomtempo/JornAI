import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "./env";

/**
 * Media storage abstraction. The final art has to end up at a public HTTPS URL
 * (an Instagram Graph API requirement). Two backends:
 *  - "local": writes to ./public/uploads (development only).
 *  - "s3":    S3 / Cloudflare R2 / Supabase Storage, S3-compatible.
 */

export interface PutResult {
  key: string;
  url: string;
}

export interface PresignedPut {
  /** Temporary URL (direct PUT) — the browser sends the file here, without going through the function. */
  uploadUrl: string;
  /** Final public URL of the object, available before the upload finishes. */
  publicUrl: string;
  key: string;
}

export interface StorageBackend {
  put(key: string, body: Buffer, contentType: string): Promise<PutResult>;
  /** Removes the object (idempotent — must not throw if it no longer exists). */
  delete(key: string): Promise<void>;
  /** Extracts the key from a public URL, or null if the URL does not belong to this backend. */
  keyFromUrl(url: string): string | null;
  /**
   * Direct upload URL (PUT), bypassing the function — only backends with a real
   * HTTP endpoint (S3/R2) support it. `null` = the backend does not support it
   * (LocalStorage); the caller falls back to uploading via /api/upload.
   */
  presignPut(key: string, contentType: string): Promise<PresignedPut | null>;
}

// ── Local (dev) ──────────────────────────────────────────────
class LocalStorage implements StorageBackend {
  private dir = path.join(process.cwd(), "public", "uploads");

  private prefix(): string {
    return `${env.storage.publicBaseUrl.replace(/\/$/, "")}/uploads/`;
  }

  async put(key: string, body: Buffer): Promise<PutResult> {
    const dest = path.join(this.dir, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
    return { key, url: `${this.prefix()}${key}` };
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.dir, key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  keyFromUrl(url: string): string | null {
    const prefix = this.prefix();
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }

  /** No HTTP endpoint to sign — there is no way to upload directly to a local disk. */
  async presignPut(): Promise<PresignedPut | null> {
    return null;
  }
}

// ── S3 / R2 / Supabase ───────────────────────────────────────
class S3Storage implements StorageBackend {
  private async client() {
    const { S3Client } = await import("@aws-sdk/client-s3");
    const cfg = env.storage.s3;
    if (!cfg.bucket) throw new Error("S3_BUCKET is not configured.");
    return new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials:
        cfg.accessKeyId && cfg.secretAccessKey
          ? {
              accessKeyId: cfg.accessKeyId,
              secretAccessKey: cfg.secretAccessKey,
            }
          : undefined,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<PutResult> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: env.storage.s3.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    const base = env.storage.s3.publicUrl?.replace(/\/$/, "");
    if (!base) {
      throw new Error(
        "S3_PUBLIC_URL is not configured — required for the art's public URL.",
      );
    }
    return { key, url: `${base}/${key}` };
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new DeleteObjectCommand({ Bucket: env.storage.s3.bucket, Key: key }),
    );
  }

  keyFromUrl(url: string): string | null {
    const base = env.storage.s3.publicUrl?.replace(/\/$/, "");
    if (!base || !url.startsWith(`${base}/`)) return null;
    return url.slice(base.length + 1);
  }

  /**
   * Signed URL for a direct PUT to the bucket (5 min validity) — the browser
   * sends the video here without going through the function's body, so
   * Vercel's payload ceiling (much lower than the 100 MB the app accepts)
   * never comes into play. Needs CORS enabled on the bucket to accept PUT from
   * the site's origin (see README/deploy).
   */
  async presignPut(key: string, contentType: string): Promise<PresignedPut | null> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.client();
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: env.storage.s3.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 300 },
    );

    const base = env.storage.s3.publicUrl?.replace(/\/$/, "");
    if (!base) {
      throw new Error(
        "S3_PUBLIC_URL is not configured — required for the art's public URL.",
      );
    }
    return { uploadUrl, publicUrl: `${base}/${key}`, key };
  }
}

let backend: StorageBackend | null = null;

export function getStorage(): StorageBackend {
  if (backend) return backend;
  backend = env.storage.provider === "s3" ? new S3Storage() : new LocalStorage();
  return backend;
}

/** High-level helper to write a buffer and get the public URL. */
export function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<PutResult> {
  return getStorage().put(key, body, contentType);
}

/** High-level helper to request a direct upload URL (see StorageBackend.presignPut). */
export function presignPut(key: string, contentType: string): Promise<PresignedPut | null> {
  return getStorage().presignPut(key, contentType);
}

/** Deletes the object behind a public URL stored in the database. Does not throw if the URL does not belong to the configured backend — it only warns (e.g. left over from a provider migration). */
export async function deleteObjectByUrl(url: string): Promise<void> {
  const storage = getStorage();
  const key = storage.keyFromUrl(url);
  if (!key) {
    console.warn(`[JornAI] URL fora do storage configurado, ignorando: ${url}`);
    return;
  }
  await storage.delete(key);
}
