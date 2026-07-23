import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { PricingService } from './pricing.service';

@Controller('pricing')
@Roles('ADMIN', 'SUPERVISOR', 'CASHIER', 'AUDITOR')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('config')
  getConfig() {
    return this.pricingService.getConfig();
  }
}
