import { ServiceUnavailableException } from '@nestjs/common';

import { AuthHttpExceptionFilter } from './auth-http-exception.filter';

describe('AuthHttpExceptionFilter', () => {
  it('preserves an explicit service unavailable status', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json, setHeader: jest.fn() }),
        getRequest: () => ({ path: '/health/ready' }),
      }),
    };

    new AuthHttpExceptionFilter().catch(
      new ServiceUnavailableException(),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'HTTP_503',
        message: 'Service unavailable.',
      },
    });
  });
});
