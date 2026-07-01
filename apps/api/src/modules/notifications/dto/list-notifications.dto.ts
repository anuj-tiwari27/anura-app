import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ListNotificationsDto {
  /**
   * Optional read/unread filter.
   *   ?unread=true  -> only unread
   *   ?unread=false -> only read
   *   (omitted)     -> all
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  unread?: boolean;
}
