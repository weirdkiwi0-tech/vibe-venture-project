import { Injectable } from '@nestjs/common';

export type HealthResponse = {
  status: 'ok';
};

const HEALTH_OK_RESPONSE: HealthResponse = {
  status: 'ok',
};

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return HEALTH_OK_RESPONSE;
  }
}
