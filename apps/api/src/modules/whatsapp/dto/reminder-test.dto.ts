import { IsString, IsNotEmpty } from 'class-validator';

/** Body for POST /whatsapp/reminders/test. */
export class ReminderTestDto {
  @IsString()
  @IsNotEmpty()
  caseId!: string;
}
