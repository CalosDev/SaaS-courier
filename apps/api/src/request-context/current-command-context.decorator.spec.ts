import { buildCurrentCommandContext } from './current-command-context.decorator';
import type { RequestWithMetadata } from './request-context.types';

describe('buildCurrentCommandContext', () => {
  it('derives actor and tenant only from request.auth', () => {
    const request = {
      auth: {
        userId: '0c20e5ee-43c1-41bd-b357-d617559e59cc',
        employeeId: '8641345f-b454-447c-a034-bf80c06e7062',
        organizationId: 'a83a1f26-40f9-4be0-86a5-b78de4a06ea9',
      },
      requestMetadata: {
        requestId: '613769cc-6261-41bc-bb57-b76367f67eaa',
        correlationId: 'admin:update',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
      body: {
        organizationId: 'client-tenant',
        actorUserId: 'client-user',
      },
    } as unknown as RequestWithMetadata;

    expect(buildCurrentCommandContext(request)).toEqual({
      organizationId: 'a83a1f26-40f9-4be0-86a5-b78de4a06ea9',
      actorType: 'EMPLOYEE',
      actorUserId: '0c20e5ee-43c1-41bd-b357-d617559e59cc',
      actorEmployeeId: '8641345f-b454-447c-a034-bf80c06e7062',
      source: 'HTTP',
      requestId: '613769cc-6261-41bc-bb57-b76367f67eaa',
      correlationId: 'admin:update',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });
  });
});
