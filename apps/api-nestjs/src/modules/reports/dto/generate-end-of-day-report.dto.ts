import { IsOptional, IsString } from 'class-validator';

export class GenerateEndOfDayReportDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  terminalId?: string;

  @IsOptional()
  @IsString()
  cashierId?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  generatedBy?: string;
}
