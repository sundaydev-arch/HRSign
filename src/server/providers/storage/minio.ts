/**
 * MinioStorageProvider — default Phase 1 implementation (spec 2 / 12).
 *
 * Object storage backed by any S3-compatible service (MinIO by default).
 *   - Storage keys carry a version suffix; overwriting is rejected (spec 3.2).
 *   - Master seal images are read server-side only, never sent to clients.
 *   - Presigned GET URLs are short-lived (default 5 minutes, spec 12).
 *   - AWS S3 / Alibaba OSS / Tencent COS can be substituted behind the
 *     StorageProvider interface.
 */

import { Client } from "minio";
import type { Readable } from "node:stream";
import type { StorageProvider } from "../types";

export interface MinioStorageProviderDeps {
  client: Client;
  bucket: string;
  /** Default presigned URL lifetime in seconds (default 300 = 5 minutes). */
  defaultPresignExpiresSeconds?: number;
}

/** Thrown when a put would overwrite an existing object (spec 3.2). */
export class ObjectAlreadyExistsError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(`Object already exists, overwrite is forbidden: ${key} (spec 3.2 version retention)`);
    this.name = "ObjectAlreadyExistsError";
    this.key = key;
  }
}

export class MinioStorageProvider implements StorageProvider {
  private readonly client: Client;
  private readonly bucket: string;
  private readonly defaultPresignExpiresSeconds: number;

  constructor(deps: MinioStorageProviderDeps) {
    this.client = deps.client;
    this.bucket = deps.bucket;
    this.defaultPresignExpiresSeconds = deps.defaultPresignExpiresSeconds ?? 300;
  }

  async put(input: {
    key: string;
    data: Buffer | Readable;
    contentType: string;
    allowOverwrite?: boolean;
  }): Promise<void> {
    // Version retention (spec 3.2): reject overwrites unless explicitly allowed
    // (e.g. replacing the bundled static font asset).
    if (!input.allowOverwrite && (await this.exists(input.key))) {
      throw new ObjectAlreadyExistsError(input.key);
    }

    // -1 means the stream length is unknown; MinIO accepts that for streams.
    const size = input.data instanceof Buffer ? input.data.length : -1;

    await this.client.putObject(this.bucket, input.key, input.data, size, {
      "Content-Type": input.contentType,
    });
  }

  async get(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  async presignGet(input: { key: string; expiresIn?: number }): Promise<string> {
    const expires = input.expiresIn ?? this.defaultPresignExpiresSeconds;
    // Short-lived URLs (spec 12): clamp to 60..3600 seconds.
    const safeExpires = Math.min(Math.max(expires, 60), 3600);
    return await this.client.presignedGetObject(this.bucket, input.key, safeExpires);
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================
// Default instance factory (built from environment variables)
// ============================================================

const globalForStorage = globalThis as unknown as {
  hrsignStorage: MinioStorageProvider | undefined;
};

function createClientFromEnv(): Client {
  return new Client({
    endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin123",
  });
}

/**
 * Return the process-wide default storage provider, creating it lazily from
 * MINIO_* environment variables on first use. The instance is cached on
 * globalThis to survive Next.js dev hot reloads.
 */
export function getDefaultStorage(): MinioStorageProvider {
  const cached = globalForStorage.hrsignStorage;
  if (cached) return cached;

  const instance = new MinioStorageProvider({
    client: createClientFromEnv(),
    bucket: process.env.MINIO_BUCKET ?? "hrsign",
    defaultPresignExpiresSeconds: Number(process.env.MINIO_PRESIGN_SECONDS ?? 300),
  });
  globalForStorage.hrsignStorage = instance;
  return instance;
}

/** Test/extension hook: replace the default instance explicitly. */
export function initDefaultStorage(client: Client, bucket: string): void {
  globalForStorage.hrsignStorage = new MinioStorageProvider({
    client,
    bucket,
    defaultPresignExpiresSeconds: Number(process.env.MINIO_PRESIGN_SECONDS ?? 300),
  });
}
