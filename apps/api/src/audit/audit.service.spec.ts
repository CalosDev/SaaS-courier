import { AuditService } from './audit.service';

describe('AuditService', () => {
  const repository = {
    list: jest.fn(),
  };
  const service = new AuditService(repository);

  beforeEach(() => jest.clearAllMocks());

  it('always scopes the query to the authenticated organization', async () => {
    repository.list.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });

    await service.list('tenant-from-session', {
      page: 2,
      pageSize: 25,
      action: 'facility.created',
    });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'tenant-from-session',
        page: 2,
        pageSize: 25,
        action: 'facility.created',
      }),
    );
  });

  it('rejects date ranges longer than 90 days', async () => {
    await expect(
      service.list('tenant', {
        occurredFrom: '2026-01-01T00:00:00.000Z',
        occurredTo: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('90 days');
  });
});
