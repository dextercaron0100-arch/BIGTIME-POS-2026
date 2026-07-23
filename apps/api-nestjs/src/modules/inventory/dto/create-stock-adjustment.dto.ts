import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const inventoryAdjustmentActions = ['STOCK_IN', 'SET_BALANCE'] as const;

export type InventoryAdjustmentAction =
  (typeof inventoryAdjustmentActions)[number];

export class CreateStockAdjustmentDto {
  @IsString()
  @MaxLength(120)
  branchId!: string;

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

  @IsIn(inventoryAdjustmentActions)
  action!: InventoryAdjustmentAction;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderPoint!: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;
}
