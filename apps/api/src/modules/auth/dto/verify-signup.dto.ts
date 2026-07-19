import { IsEmail, IsString, Length } from 'class-validator';

/** Body for POST /auth/signup/verify — confirms the emailed signup code. */
export class VerifySignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'Enter the 6-digit code' })
  code!: string;
}
