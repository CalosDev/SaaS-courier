import {
  InvalidOrganizationInputError,
  OrganizationNotFoundError,
} from './organization.errors';
import type {
  CreateOrganizationRecord,
  OrganizationRecord,
} from './organization.types';
import { OrganizationsService } from './organizations.service';

function buildOrganizationRecord(
  overrides: Partial<OrganizationRecord> = {},
): OrganizationRecord {
  const now = new Date('2026-06-28T00:00:00.000Z');

  return {
    id: 'a7c1223d-55cf-4e1f-92e5-cf3bb2b8fa28',
    legalName: 'Courier Legal Name',
    commercialName: 'Courier Commercial Name',
    slug: 'courier-saas',
    rnc: '101010101',
    email: 'ops@courier.test',
    phone: '809-555-0101',
    countryCode: 'DO',
    currencyCode: 'DOP',
    timezone: 'America/Santo_Domingo',
    status: 'TRIAL',
    planCode: 'PILOT',
    maxUsers: 5,
    maxFacilities: 2,
    trialEndsAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe('OrganizationsService', () => {
  const repository = {
    create: jest.fn<Promise<OrganizationRecord>, [CreateOrganizationRecord]>(),
    findById: jest.fn<Promise<OrganizationRecord | null>, [string]>(),
    findBySlug: jest.fn<Promise<OrganizationRecord | null>, [string]>(),
    updateProfile: jest.fn<Promise<OrganizationRecord | null>, [unknown]>(),
  };

  const service = new OrganizationsService(repository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes legalName and commercialName before creating', async () => {
    const organization = buildOrganizationRecord();
    repository.create.mockResolvedValueOnce(organization);

    await service.create({
      legalName: '  Courier Legal Name  ',
      commercialName: '  Courier Commercial Name  ',
      slug: 'courier-saas',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        legalName: 'Courier Legal Name',
        commercialName: 'Courier Commercial Name',
      }),
    );
  });

  it('normalizes slug and email to lowercase before creating', async () => {
    const organization = buildOrganizationRecord();
    repository.create.mockResolvedValueOnce(organization);

    await service.create({
      legalName: 'Courier Legal Name',
      commercialName: 'Courier Commercial Name',
      slug: '  COURIER-SAAS  ',
      email: '  Ops@Courier.Test  ',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'courier-saas',
        email: 'ops@courier.test',
      }),
    );
  });

  it('stores optional empty fields as null', async () => {
    const organization = buildOrganizationRecord({
      rnc: null,
      email: null,
      phone: null,
    });
    repository.create.mockResolvedValueOnce(organization);

    await service.create({
      legalName: 'Courier Legal Name',
      commercialName: 'Courier Commercial Name',
      slug: 'courier-saas',
      rnc: '   ',
      email: '   ',
      phone: '   ',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        rnc: null,
        email: null,
        phone: null,
      }),
    );
  });

  it('rejects an empty legalName', async () => {
    await expect(
      service.create({
        legalName: '   ',
        commercialName: 'Courier',
        slug: 'courier-saas',
      }),
    ).rejects.toBeInstanceOf(InvalidOrganizationInputError);
  });

  it('rejects an empty commercialName', async () => {
    await expect(
      service.create({
        legalName: 'Courier',
        commercialName: '   ',
        slug: 'courier-saas',
      }),
    ).rejects.toBeInstanceOf(InvalidOrganizationInputError);
  });

  it('rejects an empty slug', async () => {
    await expect(
      service.create({
        legalName: 'Courier',
        commercialName: 'Courier',
        slug: '   ',
      }),
    ).rejects.toBeInstanceOf(InvalidOrganizationInputError);
  });

  it('rejects an invalid slug format', async () => {
    await expect(
      service.create({
        legalName: 'Courier',
        commercialName: 'Courier',
        slug: 'courier saas',
      }),
    ).rejects.toBeInstanceOf(InvalidOrganizationInputError);
  });

  it('getById returns an organization when it exists', async () => {
    const organization = buildOrganizationRecord();
    repository.findById.mockResolvedValueOnce(organization);

    await expect(service.getById(organization.id)).resolves.toEqual(
      organization,
    );
  });

  it('getById throws OrganizationNotFoundError when missing', async () => {
    repository.findById.mockResolvedValueOnce(null);

    await expect(
      service.getById('0f78b860-a9d0-45b4-a21e-02e7da5ca951'),
    ).rejects.toBeInstanceOf(OrganizationNotFoundError);
  });

  it('getBySlug returns an organization when it exists', async () => {
    const organization = buildOrganizationRecord();
    repository.findBySlug.mockResolvedValueOnce(organization);

    await expect(service.getBySlug(organization.slug)).resolves.toEqual(
      organization,
    );
  });

  it('getBySlug throws OrganizationNotFoundError when missing', async () => {
    repository.findBySlug.mockResolvedValueOnce(null);

    await expect(service.getBySlug('missing-slug')).rejects.toBeInstanceOf(
      OrganizationNotFoundError,
    );
  });

  it('updateProfile normalizes names before persisting', async () => {
    const organization = buildOrganizationRecord({
      legalName: 'Updated Legal Name',
      commercialName: 'Updated Commercial Name',
    });
    repository.updateProfile.mockResolvedValueOnce(organization);

    await service.updateProfile(organization.id, {
      legalName: '  Updated Legal Name  ',
      commercialName: '  Updated Commercial Name  ',
    });

    expect(repository.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: organization.id,
        legalName: 'Updated Legal Name',
        commercialName: 'Updated Commercial Name',
      }),
    );
  });

  it('updateProfile normalizes email to lowercase and trims it', async () => {
    const organization = buildOrganizationRecord({
      email: 'updated@courier.test',
    });
    repository.updateProfile.mockResolvedValueOnce(organization);

    await service.updateProfile(organization.id, {
      email: '  Updated@Courier.Test  ',
    });

    expect(repository.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: organization.id,
        email: 'updated@courier.test',
      }),
    );
  });

  it('updateProfile stores optional empty strings as null', async () => {
    const organization = buildOrganizationRecord({
      rnc: null,
      email: null,
      phone: null,
    });
    repository.updateProfile.mockResolvedValueOnce(organization);

    await service.updateProfile(organization.id, {
      rnc: '   ',
      email: '   ',
      phone: '   ',
    });

    expect(repository.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: organization.id,
        rnc: null,
        email: null,
        phone: null,
      }),
    );
  });

  it('updateProfile rejects an empty body', async () => {
    await expect(
      service.updateProfile('c0ea1ef1-5171-4e29-a214-aa2b734f9697', {}),
    ).rejects.toBeInstanceOf(InvalidOrganizationInputError);
  });

  it('updateProfile rejects an empty legalName when provided', async () => {
    await expect(
      service.updateProfile('f702d292-d74a-4107-9b74-1d0bda1dc39f', {
        legalName: '   ',
      }),
    ).rejects.toBeInstanceOf(InvalidOrganizationInputError);
  });

  it('updateProfile rejects an empty commercialName when provided', async () => {
    await expect(
      service.updateProfile('b233c8f3-725b-4735-af0b-7ce86c5dc82a', {
        commercialName: '   ',
      }),
    ).rejects.toBeInstanceOf(InvalidOrganizationInputError);
  });

  it('updateProfile uses the organizationId passed by the caller', async () => {
    const organization = buildOrganizationRecord();
    repository.updateProfile.mockResolvedValueOnce(organization);

    await service.updateProfile(organization.id, {
      phone: ' 809-555-0110 ',
    });

    expect(repository.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: organization.id,
      }),
    );
  });
});
