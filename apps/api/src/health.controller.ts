import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  service: 'squadpost-api';
  status: 'ok';
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      service: 'squadpost-api',
      status: 'ok',
    };
  }
}
