import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { PutObjectInput, StorageProvider } from './storage.types';

/**
 * Local-disk fallback used when STORAGE_PROVIDER=filesystem.
 * Signed URLs aren't real signatures here; downloads should go through the
 * API's document raw-serve route in this mode. Prefer MinIO/S3 for parity.
 */
export class FilesystemStorageProvider implements StorageProvider {
  readonly name = 'filesystem';
  private readonly root = path.resolve(process.cwd(), 'storage');

  constructor(private readonly publicBase: string) {}

  private full(key: string): string {
    return path.join(this.root, key);
  }

  async putObject({ key, body }: PutObjectInput): Promise<void> {
    const dest = this.full(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
  }

  async getObject(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key));
  }

  async deleteObject(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true });
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    return this.getPublicUrl(key);
  }

  async getSignedUploadUrl(key: string): Promise<string> {
    return this.getPublicUrl(key);
  }

  getPublicUrl(key: string): string {
    return this.publicBase ? `${this.publicBase}/${key}` : `/storage/${key}`;
  }
}
