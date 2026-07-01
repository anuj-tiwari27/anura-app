import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { NotificationView } from '@anura/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser('sub') userId: string,
    @Query() query: ListNotificationsDto,
  ): Promise<NotificationView[]> {
    return this.notifications.list(userId, query.unread);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('sub') userId: string): Promise<{ count: number }> {
    return this.notifications.unreadCount(userId);
  }

  @Post(':id/read')
  markRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<NotificationView> {
    return this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser('sub') userId: string): Promise<{ updated: number }> {
    return this.notifications.markAllRead(userId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.notifications.remove(userId, id);
  }
}
