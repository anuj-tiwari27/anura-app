export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

/** Object storage abstraction (S3 / Cloudflare R2 / MinIO / local disk). */
export interface StorageProvider {
  readonly name: string;
  putObject(input: PutObjectInput): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string>;
  getPublicUrl(key: string): string;
}
