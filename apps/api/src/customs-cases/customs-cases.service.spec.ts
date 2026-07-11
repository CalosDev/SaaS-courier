import { Test, TestingModule } from '@nestjs/testing';
import { CustomsCasesService } from './customs-cases.service';
import { PrismaCustomsCasesRepository } from './prisma-customs-cases.repository';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../audit/prisma-audit-outbox.writer', () => {
  return {
    PrismaAuditOutboxWriter: jest.fn().mockImplementation(() => ({
      write: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('CustomsCasesService', () => {
  let service: CustomsCasesService;
  let repository: any;
  let prisma: any;

  const mockContext = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(async () => {
    repository = {
      findById: jest.fn(),
      findAll: jest.fn(),
    };

    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      customsCase: {
        create: jest.fn(),
        update: jest.fn(),
      },
      customsCaseEvent: {
        create: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomsCasesService,
        {
          provide: PrismaCustomsCasesRepository,
          useValue: repository,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CustomsCasesService>(CustomsCasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create should create a case and write audit log', async () => {
    prisma.customsCase.create.mockResolvedValue({ id: 'case-1' });
    const dto = { caseNumber: '123' } as any;

    const result = await service.create(mockContext, dto);
    expect(result).toEqual({ id: 'case-1' });
    expect(prisma.customsCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organizationId: 'org-1',
          caseNumber: '123',
        },
      }),
    );
  });

  it('findById should return a case if exists', async () => {
    repository.findById.mockResolvedValue({ id: 'case-1' });
    const result = await service.findById(mockContext, 'case-1');
    expect(result).toEqual({ id: 'case-1' });
  });

  it('findById should throw if not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findById(mockContext, 'case-1')).rejects.toThrow();
  });

  it('findAll should call repository', async () => {
    repository.findAll.mockResolvedValue([]);
    const result = await service.findAll(mockContext, {});
    expect(result).toEqual([]);
    expect(repository.findAll).toHaveBeenCalledWith({
      skip: undefined,
      take: undefined,
      where: { organizationId: 'org-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('recordEvent should create an event', async () => {
    repository.findById.mockResolvedValue({ id: 'case-1' });
    prisma.customsCaseEvent.create.mockResolvedValue({ id: 'event-1' });

    const result = await service.recordEvent(mockContext, 'case-1', {
      source: 'DGA',
      eventDate: '2023-01-01',
      description: 'Desc',
    } as any);

    expect(result).toEqual({ id: 'event-1' });
    expect(prisma.customsCaseEvent.create).toHaveBeenCalled();
  });

  it('changeStatus should update status if different', async () => {
    repository.findById.mockResolvedValue({ id: 'case-1', status: 'OPEN' });
    prisma.customsCase.update.mockResolvedValue({
      id: 'case-1',
      status: 'CLOSED',
    });

    const result = await service.changeStatus(mockContext, 'case-1', {
      status: 'CLOSED',
    } as any);
    expect(result).toEqual({ id: 'case-1', status: 'CLOSED' });
    expect(prisma.customsCase.update).toHaveBeenCalled();
  });

  it('changeStatus should do nothing if status is same', async () => {
    repository.findById.mockResolvedValue({ id: 'case-1', status: 'OPEN' });
    const result = await service.changeStatus(mockContext, 'case-1', {
      status: 'OPEN',
    } as any);
    expect(result).toEqual({ id: 'case-1', status: 'OPEN' });
    expect(prisma.customsCase.update).not.toHaveBeenCalled();
  });
});
