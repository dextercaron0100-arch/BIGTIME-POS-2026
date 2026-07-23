import { ArrayMaxSize, IsArray, IsBoolean, IsString } from 'class-validator';

export class UpdateBirSettingsDto {
  @IsBoolean()
  birEnabled!: boolean;

  @IsBoolean()
  autoZRead!: boolean;

  @IsString()
  storeName!: string;

  @IsString()
  proprietorName!: string;

  @IsString()
  vatTin!: string;

  @IsString()
  permitNumber!: string;

  @IsString()
  permitDateIssued!: string;

  @IsString()
  authorityToPrintNumber!: string;

  @IsString()
  authorityToPrintDateIssued!: string;

  @IsString()
  approvedSerialRange!: string;

  @IsString()
  machineIdentificationNumber!: string;

  @IsString()
  serialNumber!: string;

  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  businessAddressLines!: string[];

  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  footerLines!: string[];
}
