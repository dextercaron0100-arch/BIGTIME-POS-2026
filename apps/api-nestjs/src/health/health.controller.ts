import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  getStatus() {
    return {
      status: 'ok',
      service: 'apex-pos-api',
      timestamp: new Date().toISOString(),
      dependencies: {
        postgresConfigured: Boolean(process.env.DATABASE_URL),
        redisConfigured: Boolean(process.env.REDIS_URL),
      },
    };
  }
}
