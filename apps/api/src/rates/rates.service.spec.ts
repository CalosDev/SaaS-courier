import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { OrganizationSettingsService } from '../organization-settings/organization-settings.service';
import { InvalidRatesInputError, RateQuoteConflictError } from './rates.errors';
import { RatesRepository } from './rates.repository';
import { RatesService } from './rates.service';
import type { RateCardRecord, RateRuleRecord } from './rates.types';

describe('RatesService', () => {
  let service: RatesService;
  let repository: jest.Mocked<RatesRepository>;
  let settingsService: jest.Mocked<OrganizationSettingsService>;

  const mockOrganizationId = randomUUID();
  const mockServiceId = randomUUID();
  const mockRateCardId = randomUUID();

  beforeEach(async () => {
    repository = {
      listServices: jest.fn(),
      findServiceById: jest.fn(),
      createService: jest.fn(),
      updateService: jest.fn(),
      listRateCards: jest.fn(),
      findRateCardById: jest.fn(),
      createRateCard: jest.fn(),
      updateRateCard: jest.fn(),
      replaceRateRules: jest.fn(),
      activateRateCard: jest.fn(),
    };

    settingsService = {
      getCurrent: jest.fn().mockResolvedValue({
        organization: { currencyCode: 'DOP' },
        settings: { weightUnit: 'LB' },
      }),
    } as unknown as jest.Mocked<OrganizationSettingsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatesService,
        { provide: RatesRepository, useValue: repository },
        { provide: OrganizationSettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<RatesService>(RatesService);
  });

  describe('quote', () => {
    const buildRateCard = (
      calculationType: RateCardRecord['calculationType'],
      rules: Partial<RateRuleRecord>[],
    ): RateCardRecord => ({
      id: mockRateCardId,
      organizationId: mockOrganizationId,
      service: {
        id: mockServiceId,
        code: 'EXP',
        name: 'Express',
        isActive: true,
      },
      previousRateCardId: null,
      name: 'Test Card',
      segmentKey: 'DEFAULT',
      segmentName: 'Default',
      calculationType,
      version: 1,
      status: 'ACTIVE',
      currencyCode: 'DOP',
      weightUnit: 'LB',
      effectiveFrom: new Date(),
      effectiveTo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      rules: rules as RateRuleRecord[],
    });

    it('should throw if rate card is not active', async () => {
      const card = buildRateCard('FLAT', []);
      card.status = 'DRAFT';
      repository.findRateCardById.mockResolvedValue(card);

      await expect(
        service.quote(mockOrganizationId, {
          rateCardId: mockRateCardId,
          weight: 1,
        }),
      ).rejects.toThrow(RateQuoteConflictError);
    });

    it('should calculate FLAT rate correctly', async () => {
      const card = buildRateCard('FLAT', [
        {
          id: randomUUID(),
          sortOrder: 1,
          minWeight: null,
          maxWeight: null,
          flatAmountMinor: 150000n, // $1,500.00
          unitAmountMinor: null,
        },
      ]);
      repository.findRateCardById.mockResolvedValue(card);

      const quote = await service.quote(mockOrganizationId, {
        rateCardId: mockRateCardId,
        weight: 10,
        customsAmountMinor: 50000,
      });

      expect(quote.courierAmountMinor).toBe(150000n);
      expect(quote.customsAmountMinor).toBe(50000n);
      expect(quote.totalAmountMinor).toBe(200000n);
    });

    it('should calculate PER_WEIGHT rate correctly', async () => {
      const card = buildRateCard('PER_WEIGHT', [
        {
          id: randomUUID(),
          sortOrder: 1,
          minWeight: null,
          maxWeight: null,
          flatAmountMinor: null,
          unitAmountMinor: 20000n, // $200.00 per unit
        },
      ]);
      repository.findRateCardById.mockResolvedValue(card);

      const quote = await service.quote(mockOrganizationId, {
        rateCardId: mockRateCardId,
        weight: 3.5, // 3500 thousandths
      });

      // 20000n * 3500n = 70000000n / 1000n = 70000n -> $700.00
      expect(quote.courierAmountMinor).toBe(70000n);
    });

    it('should calculate PER_PIECE rate correctly', async () => {
      const card = buildRateCard('PER_PIECE', [
        {
          id: randomUUID(),
          sortOrder: 1,
          minWeight: null,
          maxWeight: null,
          flatAmountMinor: null,
          unitAmountMinor: 50000n, // $500.00 per piece
        },
      ]);
      repository.findRateCardById.mockResolvedValue(card);

      const quote = await service.quote(mockOrganizationId, {
        rateCardId: mockRateCardId,
        weight: 10,
        pieceCount: 3,
      });

      expect(quote.courierAmountMinor).toBe(150000n); // 50000n * 3
    });

    it('should calculate TIERED_WEIGHT correctly', async () => {
      const card = buildRateCard('TIERED_WEIGHT', [
        {
          id: randomUUID(),
          sortOrder: 1,
          minWeight: '0.000',
          maxWeight: '5.000',
          flatAmountMinor: 100000n,
          unitAmountMinor: null,
        },
        {
          id: randomUUID(),
          sortOrder: 2,
          minWeight: '5.000',
          maxWeight: '10.000',
          flatAmountMinor: 180000n,
          unitAmountMinor: null,
        },
        {
          id: randomUUID(),
          sortOrder: 3,
          minWeight: '10.000',
          maxWeight: null,
          flatAmountMinor: 250000n,
          unitAmountMinor: null,
        },
      ]);
      repository.findRateCardById.mockResolvedValue(card);

      const quote1 = await service.quote(mockOrganizationId, {
        rateCardId: mockRateCardId,
        weight: 3,
      });
      expect(quote1.courierAmountMinor).toBe(100000n);

      const quote2 = await service.quote(mockOrganizationId, {
        rateCardId: mockRateCardId,
        weight: 5,
      });
      expect(quote2.courierAmountMinor).toBe(180000n);

      const quote3 = await service.quote(mockOrganizationId, {
        rateCardId: mockRateCardId,
        weight: 15,
      });
      expect(quote3.courierAmountMinor).toBe(250000n);
    });

    it('should throw RateQuoteConflictError if weight does not match any tier', async () => {
      const card = buildRateCard('TIERED_WEIGHT', [
        {
          id: randomUUID(),
          sortOrder: 1,
          minWeight: '1.000',
          maxWeight: '5.000',
          flatAmountMinor: 100000n,
          unitAmountMinor: null,
        },
      ]);
      repository.findRateCardById.mockResolvedValue(card);

      await expect(
        service.quote(mockOrganizationId, {
          rateCardId: mockRateCardId,
          weight: 0.5,
        }),
      ).rejects.toThrow(RateQuoteConflictError);
    });
  });

  describe('replaceRateRules', () => {
    it('should validate non-overlapping rules for TIERED_WEIGHT', async () => {
      const card = {
        calculationType: 'TIERED_WEIGHT',
      } as RateCardRecord;
      repository.findRateCardById.mockResolvedValue(card);

      await expect(
        service.replaceRateRules(mockOrganizationId, mockRateCardId, {
          rules: [
            { minWeight: 0, maxWeight: 5, flatAmountMinor: 100000 },
            { minWeight: 4, maxWeight: 10, flatAmountMinor: 200000 }, // Overlaps
          ],
        }),
      ).rejects.toThrow(InvalidRatesInputError);
    });

    it('should validate FLAT has exactly one rule', async () => {
      const card = {
        calculationType: 'FLAT',
      } as RateCardRecord;
      repository.findRateCardById.mockResolvedValue(card);

      await expect(
        service.replaceRateRules(mockOrganizationId, mockRateCardId, {
          rules: [{ flatAmountMinor: 100000 }, { flatAmountMinor: 200000 }],
        }),
      ).rejects.toThrow(InvalidRatesInputError);
    });
  });
});
