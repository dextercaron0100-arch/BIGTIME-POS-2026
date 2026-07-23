import { IsOptional, IsString } from 'class-validator';

export class GenerateZReadingDto {
  @IsString()
  branchId!: string;

  @IsString()
  terminalId!: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  generatedBy?: string;
}
