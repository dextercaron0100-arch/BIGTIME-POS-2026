import type { PaymentMethod } from '@apex-pos/shared-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  ValidateNested,
} from 'class-validator';

const paymentMethods: PaymentMethod[] = [
  'CASH',
  'CARD',
  'GCASH',
  'MAYA',
  'SPLIT',
];

class UpdatePaymentMethodDto {
  @IsIn(paymentMethods)
  code!: PaymentMethod;

  @IsBoolean()
  enabled!: boolean;
}

export class UpdatePaymentSettingsDto {
  @IsIn(paymentMethods)
  defaultMethod!: PaymentMethod;

  @IsArray()
  @ArrayMaxSize(paymentMethods.length)
  @ValidateNested({ each: true })
  @Type(() => UpdatePaymentMethodDto)
  methods!: UpdatePaymentMethodDto[];
}
