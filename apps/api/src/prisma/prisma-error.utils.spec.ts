import { matchesPrismaUniqueConstraint } from './prisma-error.utils';

describe('matchesPrismaUniqueConstraint', () => {
  it('matches Prisma target metadata', () => {
    const error = knownRequestError('P2002', {
      target: ['organizationId', 'externalTrackingNumberNormalized'],
    });

    expect(
      matchesPrismaUniqueConstraint(
        error,
        'packages_org_external_tracking_key',
        'externalTrackingNumberNormalized',
      ),
    ).toBe(true);
  });

  it('matches driver adapter constraint fields and messages', () => {
    const error = knownRequestError('P2002', {
      driverAdapterError: {
        cause: {
          constraint: { fields: ['facility_id', 'code'] },
          originalMessage:
            'duplicate key violates warehouse_locations_org_facility_code_key',
        },
      },
    });

    expect(
      matchesPrismaUniqueConstraint(
        error,
        'warehouse_locations_org_facility_code_key',
      ),
    ).toBe(true);
    expect(
      matchesPrismaUniqueConstraint(error, 'unknown_constraint', 'facility_id'),
    ).toBe(true);
  });

  it('rejects unrelated errors and constraints', () => {
    expect(
      matchesPrismaUniqueConstraint(
        knownRequestError('P2003', { target: 'organizationId' }),
        'organizationId',
      ),
    ).toBe(false);
    expect(
      matchesPrismaUniqueConstraint(new Error('duplicate'), 'organizationId'),
    ).toBe(false);
    expect(
      matchesPrismaUniqueConstraint(
        knownRequestError('P2002', { target: 'customerId' }),
        'organizationId',
      ),
    ).toBe(false);
  });
});

function knownRequestError(code: string, meta: object): Error {
  return Object.assign(new Error('Prisma request failed'), { code, meta });
}
