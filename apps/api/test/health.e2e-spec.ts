import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

interface HealthBody {
  status: string;
  service: string;
  timestamp: string;
}

describe('Health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns HTTP 200 with health payload', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/health').expect(200);
    const body = response.body as HealthBody;

    expect(body.status).toBe('ok');
    expect(body.service).toBe('courier-api');
    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
