import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../config/configuration';
import { S3StorageProvider } from './s3.provider';
import { FilesystemStorageProvider } from './filesystem.provider';
import type { PutObjectInput, StorageProvider } from './storage.types';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private _provider?: StorageProvider;

  constructor(private readonly config: ConfigService) {}

  private get cfg(): AppConfig['storage'] {
    return this.config.get<AppConfig['storage']>('storage')!;
  }

  private provider(): StorageProvider {
    if (this._provider) return this._provider;
    const cfg = this.cfg;

    if (cfg.provider === 'filesystem') {
      this._provider = new FilesystemStorageProvider(cfg.publicUrl);
    } else {
      const client = new S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint || undefined,
        forcePathStyle: cfg.forcePathStyle,
        credentials:
          cfg.accessKeyId && cfg.secretAccessKey
            ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }
            : undefined,
      });
      this._provider = new S3StorageProvider(client, cfg.bucket, cfg.publicUrl);
    }
    this.logger.log(`Storage provider: ${this._provider.name}`);
    return this._provider;
  }

  /** Build a namespaced object key for an owner's uploaded file. */
  buildKey(lawyerId: string, filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `lawyers/${lawyerId}/${randomUUID()}-${safe}`;
  }

  putObject(input: PutObjectInput): Promise<void> {
    return this.provider().putObject(input);
  }

  getObject(key: string): Promise<Buffer> {
    return this.provider().getObject(key);
  }

  deleteObject(key: string): Promise<void> {
    return this.provider().deleteObject(key);
  }

  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string> {
    return this.provider().getSignedDownloadUrl(key, expiresInSeconds);
  }

  getSignedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string> {
    return this.provider().getSignedUploadUrl(key, contentType, expiresInSeconds);
  }

  getPublicUrl(key: string): string {
    return this.provider().getPublicUrl(key);
  }
}
