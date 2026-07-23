import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class TransactionLineItemDto {
  @IsString()
  itemId!: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsIn(['VATABLE', 'VAT_EXEMPT', 'ZERO_RATED'])
  vatType?: 'VATABLE' | 'VAT_EXEMPT' | 'ZERO_RATED';

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class TransactionPaymentDto {
  @IsIn(['CASH', 'CARD', 'GCASH', 'MAYA', 'SPLIT'])
  method!: 'CASH' | 'CARD' | 'GCASH' | 'MAYA' | 'SPLIT';

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateTransactionDto {
  @IsString()
  branchId!: string;

  @IsString()
  terminalId!: string;

  @IsString()
  cashierId!: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsIn(['SALE', 'RETURN'])
  type: 'SALE' | 'RETURN' = 'SALE';

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerTin?: string;

  @IsOptional()
  @IsString()
  customerAddress?: string;

  @IsOptional()
  @IsString()
  customerBusinessStyle?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransactionLineItemDto)
  items!: TransactionLineItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransactionPaymentDto)
  payments!: TransactionPaymentDto[];
}
