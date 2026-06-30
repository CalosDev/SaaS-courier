import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/http/public.decorator';

export interface HealthResponse {
  status: 'ok';
  service: 'courier-api';
  timestamp: string;
}

@Public()
@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'courier-api',
      timestamp: new Date().toISOString(),
    };
  }
}
