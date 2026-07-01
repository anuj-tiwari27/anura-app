import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DetectDocumentTextCommand, TextractClient } from '@aws-sdk/client-textract';
import type { AppConfig } from '../../config/configuration';

/**
 * OCR abstraction. Provider `textract` uses AWS Textract synchronous detection
 * (good for images / single-page PDFs). Provider `none` is a no-op that returns
 * an empty string so document upload still succeeds without OCR configured.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private _textract?: TextractClient;

  constructor(private readonly config: ConfigService) {}

  private get cfg(): AppConfig['ocr'] {
    return this.config.get<AppConfig['ocr']>('ocr')!;
  }

  get enabled(): boolean {
    return this.cfg.provider === 'textract';
  }

  private textract(): TextractClient {
    if (!this._textract) {
      const cfg = this.cfg;
      this._textract = new TextractClient({
        region: cfg.awsRegion,
        credentials:
          cfg.awsAccessKeyId && cfg.awsSecretAccessKey
            ? { accessKeyId: cfg.awsAccessKeyId, secretAccessKey: cfg.awsSecretAccessKey }
            : undefined,
      });
    }
    return this._textract;
  }

  async extractText(bytes: Buffer): Promise<string> {
    if (!this.enabled) return '';
    try {
      const res = await this.textract().send(new DetectDocumentTextCommand({ Document: { Bytes: bytes } }));
      return (res.Blocks ?? [])
        .filter((b) => b.BlockType === 'LINE' && b.Text)
        .map((b) => b.Text)
        .join('\n');
    } catch (err) {
      this.logger.error('Textract OCR failed', err as Error);
      return '';
    }
  }
}
