import { Test, TestingModule } from '@nestjs/testing';
import { SupportTicketController } from './support.controller';
import { SupportTicketService } from './support-ticket.service';

describe('SupportTicketController', () => {
  let controller: SupportTicketController;
  let service: SupportTicketService;

  const mockTicket = {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportTicketController],
      providers: [
        {
          provide: SupportTicketService,
          useValue: {
            createTicket: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            updateTicket: jest.fn(),
            findOpenTickets: jest.fn(),
            getTicketsByBounty: jest.fn(),
            getMetrics: jest.fn(),
            getMetricsByType: jest.fn(),
            getStatistics: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SupportTicketController>(SupportTicketController);
    service = module.get<SupportTicketService>(SupportTicketService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTicket', () => {
    it('should create a support ticket', async () => {
      const dto = {
        bountyId: 'bounty-123',
        type: 'unclear-requirement' as const,
        title: 'Test ticket',
        description: 'Test description',
      };

      jest.spyOn(service, 'createTicket').mockResolvedValue(mockTicket);

      const req = { user: { publicKey: 'contrib-123' } };
      const result = await controller.createTicket(dto, req);

      expect(result).toEqual(mockTicket);
      expect(service.createTicket).toHaveBeenCalledWith(dto, 'contrib-123');
    });
  });

  describe('getAllTickets', () => {
    it('should return all tickets with filters', async () => {
      jest
        .spyOn(service, 'findAll')
        .mockResolvedValue([mockTicket]);

      const result = await controller.getAllTickets(
        'bounty-123',
        undefined,
        'open',
        undefined,
      );

      expect(result).toEqual([mockTicket]);
      expect(service.findAll).toHaveBeenCalledWith({
        bountyId: 'bounty-123',
        contributorId: undefined,
        status: 'open',
        type: undefined,
      });
    });
  });

  describe('getTicket', () => {
    it('should return a single ticket', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockTicket);

      const result = await controller.getTicket('ticket-123');

      expect(result).toEqual(mockTicket);
      expect(service.findOne).toHaveBeenCalledWith('ticket-123');
    });
  });

  describe('updateTicket', () => {
    it('should update a ticket and set maintainerId', async () => {
      const updateDto = {
        status: 'in-progress' as const,
      };

      const updatedTicket = {
        ...mockTicket,
        status: 'in-progress',
        maintainerId: 'maintainer-123',
        acknowledgedAt: new Date(),
      };

      jest.spyOn(service, 'updateTicket').mockResolvedValue(updatedTicket);

      const req = { user: { publicKey: 'maintainer-123' } };
      const result = await controller.updateTicket('ticket-123', updateDto, req);

      expect(result.status).toBe('in-progress');
      expect(result.maintainerId).toBe('maintainer-123');
      expect(service.updateTicket).toHaveBeenCalled();
    });
  });

  describe('getOpenTickets', () => {
    it('should return only open tickets', async () => {
      jest
        .spyOn(service, 'findOpenTickets')
        .mockResolvedValue([mockTicket]);

      const result = await controller.getOpenTickets();

      expect(result).toEqual([mockTicket]);
      expect(service.findOpenTickets).toHaveBeenCalled();
    });
  });

  describe('getTicketsByBounty', () => {
    it('should return tickets for a specific bounty', async () => {
      jest
        .spyOn(service, 'getTicketsByBounty')
        .mockResolvedValue([mockTicket]);

      const result = await controller.getTicketsByBounty('bounty-123');

      expect(result).toEqual([mockTicket]);
      expect(service.getTicketsByBounty).toHaveBeenCalledWith('bounty-123');
    });
  });

  describe('getMetrics', () => {
    it('should return all metrics', async () => {
      const metrics = {
        ticketType: 'unclear-requirement',
        frequency: 5,
        avgResolution: 12,
      };

      jest
        .spyOn(service, 'getMetrics')
        .mockResolvedValue([metrics as any]);

      const result = await controller.getMetrics();

      expect(result).toHaveLength(1);
      expect(service.getMetrics).toHaveBeenCalled();
    });
  });

  describe('getMetricsByType', () => {
    it('should return metrics for a specific type', async () => {
      const metrics = {
        ticketType: 'blocker-bug',
        frequency: 3,
        avgResolution: 8,
      };

      jest
        .spyOn(service, 'getMetricsByType')
        .mockResolvedValue(metrics as any);

      const result = await controller.getMetricsByType('blocker-bug');

      expect(result).toEqual(metrics);
      expect(service.getMetricsByType).toHaveBeenCalledWith('blocker-bug');
    });
  });

  describe('getStatistics', () => {
    it('should return overall statistics', async () => {
      const stats = {
        totalTickets: 10,
        openTickets: 2,
        inProgressTickets: 3,
        resolvedTickets: 5,
        avgTimeToAcknowledge: 4,
        ticketsByType: [],
      };

      jest
        .spyOn(service, 'getStatistics')
        .mockResolvedValue(stats);

      const result = await controller.getStatistics();

      expect(result).toEqual(stats);
      expect(service.getStatistics).toHaveBeenCalled();
    });
  });
});
