import { Injectable } from '@nestjs/common';

@Injectable()
export class PricingService {
  getConfig() {
    return {
      taxes: [
        {
          id: 'tax-vat-12',
          name: 'VAT 12%',
          rate: 0.12,
          birCode: 'VAT',
          active: true,
        },
        {
          id: 'tax-exempt',
          name: 'VAT Exempt',
          rate: 0,
          birCode: 'VAT-EX',
          active: true,
        },
      ],
      discounts: [
        {
          id: 'disc-sc',
          name: 'Senior Citizen',
          type: 'PERCENTAGE',
          value: 0.2,
          requiresAuth: true,
          birCode: 'SC',
        },
        {
          id: 'disc-pwd',
          name: 'PWD',
          type: 'PERCENTAGE',
          value: 0.2,
          requiresAuth: true,
          birCode: 'PWD',
        },
        {
          id: 'disc-promo',
          name: 'Promo Discount',
          type: 'PERCENTAGE',
          value: 0.1,
          requiresAuth: false,
          birCode: 'PROMO',
        },
      ],
    };
  }
}
