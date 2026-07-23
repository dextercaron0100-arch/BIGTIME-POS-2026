import { IsString, Length } from 'class-validator';

export class UpdateTerminalSettingsDto {
  @IsString()
  @Length(2, 64)
  name!: string;
}
