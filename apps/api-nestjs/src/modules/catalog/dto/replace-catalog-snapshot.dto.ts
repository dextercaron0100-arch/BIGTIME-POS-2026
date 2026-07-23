import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CatalogCategoryDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsHexColor()
  color!: string;

  @IsString()
  groupName!: string;
}

class CatalogItemDto {
  @IsString()
  id!: string;

  @IsString()
  categoryId!: string;

  @IsString()
  name!: string;

  @IsString()
  sku!: string;

  @IsString()
  barcode!: string;

  @IsString()
  unit!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  vatType!: 'VATABLE' | 'VAT_EXEMPT' | 'ZERO_RATED';

  @IsBoolean()
  trackInventory!: boolean;

  @IsBoolean()
  hasVariants!: boolean;
}

export class ReplaceCatalogSnapshotDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogCategoryDto)
  categories!: CatalogCategoryDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogItemDto)
  items!: CatalogItemDto[];

  @IsOptional()
  @IsString()
  syncCursor?: string;
}
