import { IsIn, IsOptional, IsString } from 'class-validator';

export class TransactionQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  terminalId?: string;

  @IsOptional()
  @IsString()
  cashierId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsIn(['SALE', 'REFUND'])
  transactionType?: 'SALE' | 'REFUND';

  @IsOptional()
  @IsIn(['COMPLETED', 'VOID', 'REFUNDED', 'RETURNED'])
  status?: 'COMPLETED' | 'VOID' | 'REFUNDED' | 'RETURNED';
}
