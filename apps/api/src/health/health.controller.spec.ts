import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns the API health status', () => {
    const response = controller.getHealth();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('courier-api');
    expect(typeof response.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });
});
