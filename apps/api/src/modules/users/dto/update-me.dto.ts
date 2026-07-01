import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** Body for PATCH /users/me — basic account fields on the User record. */
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  avatarUrl?: string;
}
