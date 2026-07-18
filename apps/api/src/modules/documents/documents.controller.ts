import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { DocumentView, Paginated } from '@anura/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Query() query: QueryDocumentsDto,
  ): Promise<Paginated<DocumentView>> {
    return this.documents.list(lawyerId, query);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
  ): Promise<DocumentView> {
    return this.documents.upload(lawyerId, file, body.caseId, userId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
  ): Promise<DocumentView> {
    return this.documents.findOne(lawyerId, id);
  }

  @Get(':id/download')
  download(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
  ): Promise<{ url: string }> {
    return this.documents.getDownloadUrl(lawyerId, id);
  }

  /** Stream the file itself through the API — works for every storage provider. */
  @Get(':id/file')
  async file(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const { doc, body } = await this.documents.downloadFile(lawyerId, id, userId);
    return new StreamableFile(body, {
      type: doc.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(doc.filename)}"`,
      length: body.byteLength,
    });
  }

  /** Soft-delete: archive with a 30-day restore window before permanent deletion. */
  @Post(':id/archive')
  archive(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<DocumentView> {
    return this.documents.archive(lawyerId, id, userId);
  }

  /** Restore an archived document back to the active list. */
  @Post(':id/restore')
  restore(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<DocumentView> {
    return this.documents.restore(lawyerId, id, userId);
  }
}
