import { IsString, Length, Matches } from 'class-validator';

export class MfaCodeDto {
  @IsString()
  @Length(6, 32)
  @Matches(/^[a-z0-9\s-]+$/i, {
    message: 'MFA code must contain only letters, digits, spaces, or hyphens',
  })
  code!: string;
}
