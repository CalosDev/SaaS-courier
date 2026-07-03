import { sanitizeAuditData } from './audit-sanitizer';

describe('sanitizeAuditData', () => {
  it('removes prohibited keys recursively while preserving allowed snapshots', () => {
    expect(
      sanitizeAuditData({
        status: 'ACTIVE',
        nested: {
          password: 'secret',
          tokenHash: 'hash',
          permissionCodes: ['roles.read'],
        },
        rawData: { email: 'private@example.test' },
      }),
    ).toEqual({
      status: 'ACTIVE',
      nested: { permissionCodes: ['roles.read'] },
    });
  });

  it('masks customs document numbers', () => {
    expect(
      sanitizeAuditData({
        documentType: 'CEDULA',
        documentNumber: '00112345678',
      }),
    ).toEqual({
      documentType: 'CEDULA',
      documentNumberMasked: '*********78',
    });
  });
});
