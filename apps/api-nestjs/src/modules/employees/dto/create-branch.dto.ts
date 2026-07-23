import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-z0-9-_]+$/i)
  id?: string;
}
