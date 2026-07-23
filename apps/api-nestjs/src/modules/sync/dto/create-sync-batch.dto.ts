import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class SyncQueueEntryDto {
  @IsUUID()
  id!: string;

  @IsString()
  tableName!: string;

  @IsUUID()
  recordId!: string;

  @IsIn(['INSERT', 'UPDATE', 'DELETE'])
  operation!: 'INSERT' | 'UPDATE' | 'DELETE';

  @IsDateString()
  localCreatedAt!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class CreateSyncBatchDto {
  @IsString()
  branchId!: string;

  @IsString()
  terminalId!: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SyncQueueEntryDto)
  entries!: SyncQueueEntryDto[];
}
