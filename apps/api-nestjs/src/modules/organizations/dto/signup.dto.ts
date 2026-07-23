import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class SignupDto {
  @IsString()
  @Length(2, 80)
  businessName!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @Length(2, 80)
  ownerName!: string;

  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9]+$/i)
  employeeCode!: string;

  @IsString()
  @Length(6, 12)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}$/)
  pin!: string;
}
