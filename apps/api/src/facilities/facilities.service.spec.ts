import {
  FacilityCodeConflictError,
  FacilityLimitReachedError,
  FacilityNotFoundError,
  InvalidFacilityInputError,
} from './facility.errors';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import type {
  CreateFacilityRecord,
  FacilityListResult,
  FacilityRecord,
  ListFacilitiesRecord,
  UpdateFacilityRecord,
} from './facility.types';
import { FacilitiesService } from './facilities.service';

function buildFacilityRecord(
  overrides: Partial<FacilityRecord> = {},
): FacilityRecord {
  const now = new Date('2026-06-29T00:00:00.000Z');

  return {
    id: '50b04604-d06d-4d78-85fd-06f5ca0f001b',
    code: 'SDQ',
    name: 'Santo Domingo Branch',
    type: 'BRANCH',
    ownershipType: 'OWNED',
    countryCode: 'DO',
    province: 'Distrito Nacional',
    city: 'Santo Domingo',
    addressLine1: 'Calle 1',
    addressLine2: null,
    phone: '809-555-0101',
    email: 'branch@courier.test',
    isCustomerFacing: true,
    isPackageOrigin: false,
    isDistributionCenter: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('FacilitiesService', () => {
  const repository = {
    create: jest.fn<Promise<FacilityRecord>, [CreateFacilityRecord]>(),
    list: jest.fn<Promise<FacilityListResult>, [ListFacilitiesRecord]>(),
    findById: jest.fn<Promise<FacilityRecord | null>, [string, string]>(),
    update: jest.fn<Promise<FacilityRecord | null>, [UpdateFacilityRecord]>(),
  };

  const service = new FacilitiesService(repository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes code to uppercase and trims it before creating', async () => {
    const facility = buildFacilityRecord();
    repository.create.mockResolvedValueOnce(facility);

    await service.create('88d4f3af-c665-43a2-b1ed-26a42863e760', {
      code: '  sdq-01  ',
      name: 'Main Branch',
      type: 'BRANCH',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '88d4f3af-c665-43a2-b1ed-26a42863e760',
        code: 'SDQ-01',
      }),
    );
  });

  it('does not replace spaces in code and rejects an invalid code format', async () => {
    await expect(
      service.create('624e3dc7-4f9e-4461-b125-d161fe59edf0', {
        code: 'sdq 01',
        name: 'Main Branch',
        type: 'BRANCH',
      }),
    ).rejects.toBeInstanceOf(InvalidFacilityInputError);
  });

  it('normalizes name, countryCode, and email before creating', async () => {
    const facility = buildFacilityRecord({
      name: 'Main Branch',
      countryCode: 'DO',
      email: 'branch@courier.test',
    });
    repository.create.mockResolvedValueOnce(facility);

    await service.create('4cf5c7eb-8ba3-4fdd-8835-4a22a6a94491', {
      code: 'BR-01',
      name: '  Main Branch  ',
      type: 'BRANCH',
      countryCode: '  do  ',
      email: '  Branch@Courier.Test  ',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Main Branch',
        countryCode: 'DO',
        email: 'branch@courier.test',
      }),
    );
  });

  it('converts optional empty strings to null and applies defaults on create', async () => {
    const facility = buildFacilityRecord({
      ownershipType: 'OWNED',
      countryCode: 'DO',
      province: null,
      city: null,
      addressLine1: null,
      addressLine2: null,
      phone: null,
      email: null,
      isCustomerFacing: true,
      isPackageOrigin: false,
      isDistributionCenter: false,
      isActive: true,
    });
    repository.create.mockResolvedValueOnce(facility);

    await service.create('c07e732e-5925-4593-8be9-f9480fc64877', {
      code: 'BR-01',
      name: 'Main Branch',
      type: 'BRANCH',
      province: '   ',
      city: '   ',
      addressLine1: '   ',
      addressLine2: '   ',
      phone: '   ',
      email: '   ',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownershipType: 'OWNED',
        countryCode: 'DO',
        province: null,
        city: null,
        addressLine1: null,
        addressLine2: null,
        phone: null,
        email: null,
        isCustomerFacing: true,
        isPackageOrigin: false,
        isDistributionCenter: false,
        isActive: true,
      }),
    );
  });

  it('rejects an empty name', async () => {
    await expect(
      service.create('4176ef74-4579-453a-b7ba-36f94838015d', {
        code: 'BR-01',
        name: '   ',
        type: 'BRANCH',
      }),
    ).rejects.toBeInstanceOf(InvalidFacilityInputError);
  });

  it('rejects an invalid countryCode', async () => {
    await expect(
      service.create('b53a0db5-c0a5-425b-b73d-11a681380028', {
        code: 'BR-01',
        name: 'Main Branch',
        type: 'BRANCH',
        countryCode: 'DOM',
      }),
    ).rejects.toBeInstanceOf(InvalidFacilityInputError);
  });

  it('lists facilities with normalized pagination defaults', async () => {
    const result: FacilityListResult = {
      items: [buildFacilityRecord()],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    };
    repository.list.mockResolvedValueOnce(result);

    await expect(
      service.list('6743af85-70fe-4705-8e8d-1e6f14831f89', {}),
    ).resolves.toEqual(result);

    expect(repository.list).toHaveBeenCalledWith({
      organizationId: '6743af85-70fe-4705-8e8d-1e6f14831f89',
      page: 1,
      pageSize: 20,
      isActive: undefined,
      type: undefined,
    });
  });

  it('gets a facility only by organizationId and facilityId', async () => {
    const facility = buildFacilityRecord();
    repository.findById.mockResolvedValueOnce(facility);

    await expect(
      service.getById(
        '2ffb7f95-02b2-4197-bf72-b950d9cf7a9f',
        '8d76f20c-b936-4cb4-a2d4-d4ee08982644',
      ),
    ).resolves.toEqual(facility);

    expect(repository.findById).toHaveBeenCalledWith(
      '2ffb7f95-02b2-4197-bf72-b950d9cf7a9f',
      '8d76f20c-b936-4cb4-a2d4-d4ee08982644',
    );
  });

  it('throws not found when a facility is missing', async () => {
    repository.findById.mockResolvedValueOnce(null);

    await expect(
      service.getById(
        '47b1d194-0b0b-4251-bb23-30fc25591a75',
        '4f590602-f273-40e1-bd85-488e88d2d995',
      ),
    ).rejects.toBeInstanceOf(FacilityNotFoundError);
  });

  it('updates only the supplied fields and keeps the organization scope', async () => {
    const facility = buildFacilityRecord({
      code: 'SDQ-02',
      name: 'Updated Branch',
      email: 'updated@courier.test',
      isActive: false,
    });
    repository.update.mockResolvedValueOnce(facility);

    await service.update(
      '5e79c643-294b-4fd8-aec4-65cfe3ef68dc',
      '30100ef3-df4d-4573-9619-fda36fdca42d',
      {
        code: '  sdq-02  ',
        name: '  Updated Branch  ',
        email: '  Updated@Courier.Test  ',
        isActive: false,
      },
    );

    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '5e79c643-294b-4fd8-aec4-65cfe3ef68dc',
        facilityId: '30100ef3-df4d-4573-9619-fda36fdca42d',
        code: 'SDQ-02',
        name: 'Updated Branch',
        email: 'updated@courier.test',
        isActive: false,
      }),
    );
  });

  it('ignores optional DTO fields that are present as undefined during update', async () => {
    const facility = buildFacilityRecord({
      code: 'SDQ-MAIN',
      name: 'SDQ Main',
      phone: '809-555-0112',
      isActive: false,
    });
    repository.update.mockResolvedValueOnce(facility);

    const dto = new UpdateFacilityDto();
    dto.code = '  sdq-main ';
    dto.name = '  SDQ Main ';
    dto.phone = ' 809-555-0112 ';
    dto.isActive = false;

    await service.update(
      '118d2ca0-b6bd-4b83-bb97-104ed0b4fa85',
      'a1d293fc-0637-45cd-b31d-bf21ec4a3882',
      dto,
    );

    expect(repository.update).toHaveBeenCalledWith({
      organizationId: '118d2ca0-b6bd-4b83-bb97-104ed0b4fa85',
      facilityId: 'a1d293fc-0637-45cd-b31d-bf21ec4a3882',
      code: 'SDQ-MAIN',
      name: 'SDQ Main',
      phone: '809-555-0112',
      isActive: false,
    });
  });

  it('rejects an empty update body', async () => {
    await expect(
      service.update(
        '9e4f1742-1b2f-4dfd-a1ab-7bcaf8098db8',
        'afca1a2f-8b97-4f02-8546-f95e373dcc46',
        {},
      ),
    ).rejects.toBeInstanceOf(InvalidFacilityInputError);
  });

  it('rethrows repository conflicts for code and facility limits', async () => {
    repository.create.mockRejectedValueOnce(
      new FacilityCodeConflictError('BR-01'),
    );
    await expect(
      service.create('c51ec2a7-2512-48dc-839d-1d85cb3efb86', {
        code: 'BR-01',
        name: 'Main Branch',
        type: 'BRANCH',
      }),
    ).rejects.toBeInstanceOf(FacilityCodeConflictError);

    repository.create.mockRejectedValueOnce(new FacilityLimitReachedError(2));
    await expect(
      service.create('c51ec2a7-2512-48dc-839d-1d85cb3efb86', {
        code: 'BR-02',
        name: 'Second Branch',
        type: 'BRANCH',
      }),
    ).rejects.toBeInstanceOf(FacilityLimitReachedError);
  });
});
