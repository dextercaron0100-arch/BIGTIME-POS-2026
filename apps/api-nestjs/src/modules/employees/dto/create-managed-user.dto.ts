import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import type { UserRole } from '@apex-pos/shared-types';

const managedRoles: UserRole[] = [
  'ADMIN',
  'SUPERVISOR',
  'CASHIER',
  'INVENTORY',
  'AUDITOR',
];

export class CreateManagedUserDto {
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-z0-9-_]+$/i)
  branchId!: string;

  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9]+$/i)
  employeeCode!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @IsIn(managedRoles)
  role!: UserRole;

  @IsString()
  @Length(6, 12)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}$/)
  pin!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
