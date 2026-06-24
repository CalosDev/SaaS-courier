import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  service: 'courier-api';
  timestamp: string;
}

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
