import { IsString, Length, Matches } from 'class-validator';
import { IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-z0-9-_]+$/i)
  branchId!: string;

  @IsString()
  @Length(2, 64)
  @Matches(/^[a-z0-9-_]+$/i)
  terminalId!: string;

  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9]+$/i)
  employeeCode!: string;

  @IsString()
  @Length(4, 12)
  pin!: string;

  @IsOptional()
  @IsString()
  @Length(6, 32)
  @Matches(/^[a-z0-9\s-]+$/i)
  mfaCode?: string;

  @IsOptional()
  @IsString()
  @Length(2, 64)
  terminalName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 32)
  platform?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  appVersion?: string;
}
