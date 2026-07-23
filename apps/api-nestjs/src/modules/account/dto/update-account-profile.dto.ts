import { IsString, Length } from 'class-validator';

export class UpdateAccountProfileDto {
  @IsString()
  @Length(0, 120)
  companyName!: string;

  @IsString()
  @Length(0, 280)
  companyDescription!: string;
}
