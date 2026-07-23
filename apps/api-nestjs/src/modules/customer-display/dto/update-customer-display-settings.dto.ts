import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateCustomerDisplaySettingsDto {
  @IsString()
  thankYouMessage!: string;

  @IsBoolean()
  launchFullscreen!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(20)
  imageDurationSeconds!: number;

  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  assetIds!: string[];
}
