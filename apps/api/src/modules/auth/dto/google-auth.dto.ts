import { IsString, MinLength } from 'class-validator';

export class GoogleAuthDto {
  /** Google Identity Services ID token (JWT credential). */
  @IsString()
  @MinLength(10)
  idToken!: string;
}
