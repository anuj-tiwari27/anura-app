import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
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
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
  ): Promise<DocumentView> {
    return this.documents.upload(lawyerId, file, body.caseId);
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

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
  ): Promise<void> {
    return this.documents.remove(lawyerId, id);
  }
}
