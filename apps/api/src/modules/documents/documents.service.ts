import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Document, Prisma } from '@prisma/client';
import type { DocumentView, Paginated } from '@anura/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { OcrService } from '../../integrations/ocr/ocr.service';
import { paginated, skipTake } from '../../common/dto/pagination.dto';
import type { QueryDocumentsDto } from './dto/query-documents.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ocr: OcrService,
  ) {}

  /** Resolve the caller's lawyerId or reject if onboarding is incomplete. */
  private requireLawyerId(lawyerId: string | null | undefined): string {
    if (!lawyerId) throw new BadRequestException('Complete onboarding first');
    return lawyerId;
  }

  /** Ensure a caseId, if provided, belongs to this lawyer. */
  private async assertCaseOwnership(caseId: string, lawyerId: string): Promise<void> {
    const found = await this.prisma.case.findFirst({
      where: { id: caseId, lawyerId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Case not found');
  }

  async list(
    lawyerId: string | null | undefined,
    query: QueryDocumentsDto,
  ): Promise<Paginated<DocumentView>> {
    const owner = this.requireLawyerId(lawyerId);
    const { page = 1, pageSize = 20, search, caseId } = query;

    const where: Prisma.DocumentWhereInput = {
      lawyerId: owner,
      ...(caseId ? { caseId } : {}),
      ...(search
        ? { filename: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      this.prisma.document.count({ where }),
    ]);

    const items = await Promise.all(rows.map((row) => this.toView(row)));
    return paginated(items, total, page, pageSize);
  }

  async findOne(lawyerId: string | null | undefined, id: string): Promise<DocumentView> {
    const doc = await this.getOwned(lawyerId, id);
    return this.toView(doc);
  }

  async getDownloadUrl(
    lawyerId: string | null | undefined,
    id: string,
  ): Promise<{ url: string }> {
    const doc = await this.getOwned(lawyerId, id);
    const url = await this.storage.getSignedDownloadUrl(doc.storageKey);
    return { url };
  }

  async upload(
    lawyerId: string | null | undefined,
    file: Express.Multer.File | undefined,
    caseId?: string,
  ): Promise<DocumentView> {
    const owner = this.requireLawyerId(lawyerId);
    if (!file) throw new BadRequestException('No file uploaded');

    if (caseId) await this.assertCaseOwnership(caseId, owner);

    const key = this.storage.buildKey(owner, file.originalname);
    await this.storage.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    // Best-effort OCR: never fail the upload if OCR errors.
    let ocrText: string | null = null;
    if (this.ocr.enabled && this.isOcrable(file.mimetype)) {
      try {
        const text = await this.ocr.extractText(file.buffer);
        if (text) ocrText = text;
      } catch (err) {
        this.logger.warn(`OCR failed for ${file.originalname}: ${(err as Error).message}`);
      }
    }

    const doc = await this.prisma.document.create({
      data: {
        lawyerId: owner,
        caseId: caseId ?? null,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: key,
        status: ocrText ? 'OCR_DONE' : 'UPLOADED',
        version: 1,
        ocrText,
      },
    });

    return this.toView(doc);
  }

  async remove(lawyerId: string | null | undefined, id: string): Promise<void> {
    const doc = await this.getOwned(lawyerId, id);

    // Best-effort storage cleanup; still remove the row if the object is gone.
    try {
      await this.storage.deleteObject(doc.storageKey);
    } catch (err) {
      this.logger.warn(
        `Failed to delete storage object ${doc.storageKey}: ${(err as Error).message}`,
      );
    }

    await this.prisma.document.delete({ where: { id: doc.id } });
  }

  // --- helpers --------------------------------------------------------------

  /** Fetch a document and verify it belongs to the caller's lawyer. */
  private async getOwned(lawyerId: string | null | undefined, id: string): Promise<Document> {
    const owner = this.requireLawyerId(lawyerId);
    const doc = await this.prisma.document.findFirst({ where: { id, lawyerId: owner } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  private isOcrable(mimeType: string): boolean {
    return mimeType === 'application/pdf' || mimeType.startsWith('image/');
  }

  private async toView(doc: Document): Promise<DocumentView> {
    let downloadUrl: string | null = null;
    try {
      downloadUrl = await this.storage.getSignedDownloadUrl(doc.storageKey);
    } catch (err) {
      this.logger.warn(
        `Failed to sign download URL for ${doc.id}: ${(err as Error).message}`,
      );
    }

    return {
      id: doc.id,
      caseId: doc.caseId,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      status: doc.status,
      version: doc.version,
      hasOcr: !!doc.ocrText,
      downloadUrl,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
