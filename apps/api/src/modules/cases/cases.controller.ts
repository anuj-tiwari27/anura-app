import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type {
  CaseDetailView,
  CaseNoteView,
  CasePartyView,
  CaseSummaryView,
  Paginated,
  TimelineEventView,
} from '@anura/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { CreatePartyDto } from './dto/create-party.dto';
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { CreateNoteDto } from './dto/create-note.dto';

@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  // --- Cases CRUD -----------------------------------------------------------

  @Get()
  list(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Query() query: QueryCasesDto,
  ): Promise<Paginated<CaseSummaryView>> {
    return this.cases.list(lawyerId, query);
  }

  @Post()
  create(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Body() dto: CreateCaseDto,
  ): Promise<CaseDetailView> {
    return this.cases.create(lawyerId, dto);
  }

  @Get(':id')
  getById(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
  ): Promise<CaseDetailView> {
    return this.cases.getById(lawyerId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
    @Body() dto: UpdateCaseDto,
  ): Promise<CaseDetailView> {
    return this.cases.update(lawyerId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
  ): Promise<void> {
    return this.cases.remove(lawyerId, id);
  }

  // --- Parties --------------------------------------------------------------

  @Post(':id/parties')
  addParty(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
    @Body() dto: CreatePartyDto,
  ): Promise<CasePartyView> {
    return this.cases.addParty(lawyerId, id, dto);
  }

  @Delete(':id/parties/:partyId')
  @HttpCode(204)
  removeParty(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
    @Param('partyId') partyId: string,
  ): Promise<void> {
    return this.cases.removeParty(lawyerId, id, partyId);
  }

  // --- Timeline -------------------------------------------------------------

  @Post(':id/timeline')
  addTimeline(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
    @Body() dto: CreateTimelineDto,
  ): Promise<TimelineEventView> {
    return this.cases.addTimeline(lawyerId, id, dto);
  }

  @Delete(':id/timeline/:eventId')
  @HttpCode(204)
  removeTimeline(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
  ): Promise<void> {
    return this.cases.removeTimeline(lawyerId, id, eventId);
  }

  // --- Notes ----------------------------------------------------------------

  @Post(':id/notes')
  addNote(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
  ): Promise<CaseNoteView> {
    return this.cases.addNote(lawyerId, userId, id, dto);
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(204)
  removeNote(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    return this.cases.removeNote(lawyerId, id, noteId);
  }
}
