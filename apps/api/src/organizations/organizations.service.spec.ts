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
});
