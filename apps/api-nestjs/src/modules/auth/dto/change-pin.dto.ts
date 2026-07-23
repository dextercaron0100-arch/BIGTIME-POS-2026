import { IsString, Length, Matches } from 'class-validator';

export class ChangePinDto {
  @IsString()
  @Length(4, 12)
  currentPin!: string;

  @IsString()
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}$/, {
    message:
      'New PIN must be 6–12 characters, alphanumeric, with at least one letter and one digit',
  })
  newPin!: string;
}
