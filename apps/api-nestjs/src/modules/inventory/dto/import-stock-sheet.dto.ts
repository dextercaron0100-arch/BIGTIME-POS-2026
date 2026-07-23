import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportStockSheetRowDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  itemId?: string;

  @IsString()
  @MaxLength(180)
  itemName!: string;

  @IsString()
  @MaxLength(120)
  warehouseName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityOnHand!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderPoint?: number;
}

export class ImportStockSheetDto {
  @IsString()
  @MaxLength(120)
  branchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sourceFileName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportStockSheetRowDto)
  rows!: ImportStockSheetRowDto[];
}
