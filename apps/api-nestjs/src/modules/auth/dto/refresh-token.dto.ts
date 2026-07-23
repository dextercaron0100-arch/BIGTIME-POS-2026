import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @Length(32, 4096)
  refreshToken!: string;
}
