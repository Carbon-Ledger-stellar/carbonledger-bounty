import { Test, TestingModule } from '@nestjs/testing';
import { SupportTicketService } from './support-ticket.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SupportTicketService', () => {
  let service: SupportTicketService;
  let prismaService: PrismaService;

  const mockSupportTicket = {
    id: 'test-id',
    ticketId: 'ticket-123',
    bountyId: 'bounty-123',
    contributorId: 'contrib-123',
    maintainerId: null,
    type: 'unclear-requirement',
    status: 'open',
    title: 'Test ticket',
    description: 'Test description',
    attachments: [],
    createdAt: new Date(),
    acknowledgedAt: null,
    resolvedAt: null,
    resolution: null,
  };

  const mockSupportMetrics = {
    id: 'metrics-id',
    ticketType: 'unclear-requirement',
    frequency: 1,
    avgResolution: 0,
    lastUpdated: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportTicketService,
        {
          provide: PrismaService,
          useValue: {
            supportTicket: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            supportMetrics: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SupportTicketService>(SupportTicketService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('createTicket', () => {
    it('should create a new support ticket', async () => {
      const dto = {
        bountyId: 'bounty-123',
        type: 'unclear-requirement' as const,
        title: 'Test ticket',
        description: 'Test description',
      };

      jest
        .spyOn(prismaService.supportTicket, 'create')
        .mockResolvedValue(mockSupportTicket);
      jest
        .spyOn(prismaService.supportMetrics, 'findUnique')
        .mockResolvedValue(null);
      jest
        .spyOn(prismaService.supportMetrics, 'create')
        .mockResolvedValue(mockSupportMetrics);

      const result = await service.createTicket(dto, 'contrib-123');

      expect(result).toBeDefined();
      expect(prismaService.supportTicket.create).toHaveBeenCalled();
      expect(result.status).toBe('open');
    });

    it('should increment metrics when creating a ticket', async () => {
      const dto = {
        bountyId: 'bounty-123',
        type: 'blocker-bug' as const,
        title: 'Bug report',
        description: 'Critical bug',
      };

      jest
        .spyOn(prismaService.supportTicket, 'create')
        .mockResolvedValue(mockSupportTicket);
      jest
        .spyOn(prismaService.supportMetrics, 'findUnique')
        .mockResolvedValue(mockSupportMetrics);
      jest
        .spyOn(prismaService.supportMetrics, 'update')
        .mockResolvedValue(mockSupportMetrics);

      await service.createTicket(dto, 'contrib-123');

      expect(prismaService.supportMetrics.findUnique).toHaveBeenCalledWith({
        where: { ticketType: 'blocker-bug' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a ticket by ticketId', async () => {
      jest
        .spyOn(prismaService.supportTicket, 'findUnique')
        .mockResolvedValue(mockSupportTicket);

      const result = await service.findOne('ticket-123');

      expect(result).toEqual(mockSupportTicket);
      expect(prismaService.supportTicket.findUnique).toHaveBeenCalledWith({
        where: { ticketId: 'ticket-123' },
      });
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      jest
        .spyOn(prismaService.supportTicket, 'findUnique')
        .mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all tickets', async () => {
      jest
        .spyOn(prismaService.supportTicket, 'findMany')
        .mockResolvedValue([mockSupportTicket]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockSupportTicket);
    });

    it('should filter tickets by status', async () => {
      jest
        .spyOn(prismaService.supportTicket, 'findMany')
        .mockResolvedValue([]);

      await service.findAll({ status: 'open' });

      expect(prismaService.supportTicket.findMany).toHaveBeenCalledWith({
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter tickets by type', async () => {
      jest
        .spyOn(prismaService.supportTicket, 'findMany')
        .mockResolvedValue([]);

      await service.findAll({ type: 'blocker-bug' });

      expect(prismaService.supportTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'blocker-bug' }),
        }),
      );
    });
  });

  describe('updateTicket', () => {
    it('should update ticket status to in-progress', async () => {
      jest
        .spyOn(prismaService.supportTicket, 'findUnique')
        .mockResolvedValue(mockSupportTicket);
      jest.spyOn(prismaService.supportTicket, 'update').mockResolvedValue({
        ...mockSupportTicket,
        status: 'in-progress',
        acknowledgedAt: new Date(),
        maintainerId: 'maintainer-123',
      });

      const result = await service.updateTicket('ticket-123', {
        status: 'in-progress',
        maintainerId: 'maintainer-123',
      });

      expect(result.status).toBe('in-progress');
      expect(result.acknowledgedAt).toBeDefined();
    });

    it('should reject invalid status', async () => {
      jest
        .spyOn(prismaService.supportTicket, 'findUnique')
        .mockResolvedValue(mockSupportTicket);

      await expect(
        service.updateTicket('ticket-123', {
          status: 'invalid-status' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set resolvedAt when transitioning to resolved', async () => {
      const inProgressTicket = {
        ...mockSupportTicket,
        status: 'in-progress',
        acknowledgedAt: new Date(),
      };

      jest
        .spyOn(prismaService.supportTicket, 'findUnique')
        .mockResolvedValue(inProgressTicket);
      jest.spyOn(prismaService.supportTicket, 'update').mockResolvedValue({
        ...inProgressTicket,
        status: 'resolved',
        resolvedAt: new Date(),
        resolution: 'Fixed the issue',
      });
      jest
        .spyOn(prismaService.supportMetrics, 'findUnique')
        .mockResolvedValue(mockSupportMetrics);
      jest
        .spyOn(prismaService.supportMetrics, 'update')
        .mockResolvedValue(mockSupportMetrics);

      const result = await service.updateTicket('ticket-123', {
        status: 'resolved',
        resolution: 'Fixed the issue',
      });

      expect(result.status).toBe('resolved');
      expect(result.resolvedAt).toBeDefined();
    });
  });

  describe('findOpenTickets', () => {
    it('should return only open tickets', async () => {
      jest
        .spyOn(prismaService.supportTicket, 'findMany')
        .mockResolvedValue([mockSupportTicket]);

      const result = await service.findOpenTickets();

      expect(prismaService.supportTicket.findMany).toHaveBeenCalledWith({
        where: { status: 'open' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getStatistics', () => {
    it('should return overall statistics', async () => {
      jest.spyOn(prismaService.supportTicket, 'count').mockResolvedValue(10);
      jest
        .spyOn(prismaService.supportTicket, 'findMany')
        .mockResolvedValue([]);
      jest
        .spyOn(prismaService.supportMetrics, 'findMany')
        .mockResolvedValue([mockSupportMetrics]);

      const result = await service.getStatistics();

      expect(result).toHaveProperty('totalTickets');
      expect(result).toHaveProperty('openTickets');
      expect(result).toHaveProperty('inProgressTickets');
      expect(result).toHaveProperty('resolvedTickets');
      expect(result).toHaveProperty('avgTimeToAcknowledge');
      expect(result).toHaveProperty('ticketsByType');
    });
  });

  describe('getMetrics', () => {
    it('should return all metrics', async () => {
      jest
        .spyOn(prismaService.supportMetrics, 'findMany')
        .mockResolvedValue([mockSupportMetrics]);

      const result = await service.getMetrics();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockSupportMetrics);
    });
  });
});
