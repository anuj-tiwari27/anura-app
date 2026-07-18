import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Document, Prisma } from '@prisma/client';
import type { DocumentView, Paginated } from '@anura/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../integrations/storage/storage.service';
import { OcrService } from '../../integrations/ocr/ocr.service';
import { paginated, skipTake } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import type { QueryDocumentsDto } from './dto/query-documents.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  /** Grace window (days) an archived document is retained before permanent deletion. */
  private static readonly ARCHIVE_WINDOW_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ocr: OcrService,
    private readonly audit: AuditService,
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
    const { page = 1, pageSize = 20, search, caseId, archived } = query;

    const where: Prisma.DocumentWhereInput = {
      lawyerId: owner,
      // Archived docs are hidden from the default list; the Archived view opts in.
      status: archived ? 'ARCHIVED' : { not: 'ARCHIVED' },
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

  /**
   * Fetch the raw file bytes for an owned document. Serving through the API
   * works for every storage provider (MinIO behind Docker, S3/R2, filesystem)
   * without needing a browser-reachable storage endpoint.
   */
  async downloadFile(
    lawyerId: string | null | undefined,
    id: string,
    userId?: string,
  ): Promise<{ doc: Document; body: Buffer }> {
    const doc = await this.getOwned(lawyerId, id);
    try {
      const body = await this.storage.getObject(doc.storageKey);
      void this.audit.log({
        actorId: userId ?? null,
        action: 'document.download',
        entityType: 'DOCUMENT',
        entityId: doc.id,
        meta: { filename: doc.filename },
      });
      return { doc, body };
    } catch (err) {
      // Object store unreachable (e.g. MinIO/S3 down or misconfigured) — surface
      // a clear 503 instead of a generic 500 so the cause is obvious.
      this.logger.error(`Failed to read object ${doc.storageKey}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'Document storage is currently unavailable. Please try again shortly.',
      );
    }
  }

  async upload(
    lawyerId: string | null | undefined,
    file: Express.Multer.File | undefined,
    caseId?: string,
    userId?: string,
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

    void this.audit.log({
      actorId: userId ?? null,
      action: 'document.upload',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      meta: { filename: doc.filename, sizeBytes: doc.sizeBytes },
    });
    return this.toView(doc);
  }

  /**
   * Soft-delete: hide the document from the active list and schedule it for
   * permanent deletion after a 30-day grace window (see DocumentsPurgeService).
   * The file is NOT removed from storage yet, so it can be restored.
   */
  async archive(
    lawyerId: string | null | undefined,
    id: string,
    userId?: string,
  ): Promise<DocumentView> {
    const doc = await this.getOwned(lawyerId, id);
    if (doc.status === 'ARCHIVED') return this.toView(doc);

    const now = new Date();
    const purgeAfter = new Date(
      now.getTime() + DocumentsService.ARCHIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const updated = await this.prisma.document.update({
      where: { id: doc.id },
      data: { status: 'ARCHIVED', archivedAt: now, purgeAfter },
    });
    void this.audit.log({
      actorId: userId ?? null,
      action: 'document.archive',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      meta: { filename: doc.filename, purgeAfter: purgeAfter.toISOString() },
    });
    return this.toView(updated);
  }

  /** Restore an archived document back to the active list (cancels the purge). */
  async restore(
    lawyerId: string | null | undefined,
    id: string,
    userId?: string,
  ): Promise<DocumentView> {
    const doc = await this.getOwned(lawyerId, id);
    const updated = await this.prisma.document.update({
      where: { id: doc.id },
      data: {
        status: doc.ocrText ? 'OCR_DONE' : 'UPLOADED',
        archivedAt: null,
        purgeAfter: null,
      },
    });
    void this.audit.log({
      actorId: userId ?? null,
      action: 'document.restore',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      meta: { filename: doc.filename },
    });
    return this.toView(updated);
  }

  /**
   * Permanently delete every archived document whose 30-day window has elapsed.
   * Invoked by DocumentsPurgeService on a schedule. Best-effort + defensive so a
   * single failure never aborts the sweep.
   */
  async purgeExpired(): Promise<number> {
    const due = await this.prisma.document.findMany({
      where: { status: 'ARCHIVED', purgeAfter: { lte: new Date() } },
      select: { id: true, storageKey: true },
    });

    let purged = 0;
    for (const doc of due) {
      try {
        await this.storage.deleteObject(doc.storageKey);
      } catch (err) {
        this.logger.warn(
          `Purge: failed to delete storage object ${doc.storageKey}: ${(err as Error).message}`,
        );
      }
      try {
        await this.prisma.document.delete({ where: { id: doc.id } });
        purged += 1;
      } catch (err) {
        this.logger.warn(`Purge: failed to delete document ${doc.id}: ${(err as Error).message}`);
      }
    }
    if (purged > 0) {
      this.logger.log(`Purged ${purged} archived document(s) past their 30-day window`);
    }
    return purged;
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
      archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
