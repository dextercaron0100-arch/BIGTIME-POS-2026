import { IsOptional, IsString } from 'class-validator';

export class VoidTransactionDto {
  @IsString()
  branchId!: string;

  @IsString()
  terminalId!: string;

  @IsString()
  cashierId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;
}
