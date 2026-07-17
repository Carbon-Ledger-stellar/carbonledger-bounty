import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../prisma.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  AddBountiesCampaignDto,
} from './campaigns.dto';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    campaign: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    campaignBounty: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    leaderboardEntry: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCampaign', () => {
    it('should create a campaign successfully', async () => {
      const dto: CreateCampaignDto = {
        name: 'Q4 DevOps Push',
        description: 'Infrastructure automation focus',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-12-31'),
        goal: 50,
      };

      const mockCampaign = {
        id: '123',
        campaignId: 'campaign-123',
        ...dto,
        status: 'pending',
        featuredBounties: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.campaign.create.mockResolvedValue(mockCampaign);

      const result = await service.createCampaign(dto);

      expect(result.campaignId).toBe('campaign-123');
      expect(result.name).toBe('Q4 DevOps Push');
      expect(result.status).toBe('pending');
      expect(mockPrismaService.campaign.create).toHaveBeenCalled();
    });

    it('should throw error if endDate is before startDate', async () => {
      const dto: CreateCampaignDto = {
        name: 'Invalid Campaign',
        description: 'Test',
        startDate: new Date('2026-12-31'),
        endDate: new Date('2026-10-01'),
      };

      await expect(service.createCampaign(dto)).rejects.toThrow(
        'endDate must be after startDate',
      );
    });
  });

  describe('getCampaignById', () => {
    it('should return campaign when found', async () => {
      const mockCampaign = {
        id: '123',
        campaignId: 'campaign-123',
        name: 'Q4 DevOps Push',
        description: 'Test',
        startDate: new Date(),
        endDate: new Date(),
        goal: 50,
        status: 'active',
        featuredBounties: [],
        bounties: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);

      const result = await service.getCampaignById('campaign-123');

      expect(result.campaignId).toBe('campaign-123');
      expect(result.name).toBe('Q4 DevOps Push');
    });

    it('should throw NotFoundException when campaign not found', async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(null);

      await expect(service.getCampaignById('non-existent')).rejects.toThrow(
        'Campaign non-existent not found',
      );
    });
  });

  describe('addBountiesToCampaign', () => {
    it('should add bounties to campaign', async () => {
      const dto: AddBountiesCampaignDto = {
        campaignId: 'campaign-123',
        bountyIds: ['bounty-1', 'bounty-2'],
      };

      const mockCampaign = {
        id: '123',
        campaignId: 'campaign-123',
        goal: 50,
        bounties: [],
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaignBounty.create.mockResolvedValue({});

      await service.addBountiesToCampaign(dto);

      expect(mockPrismaService.campaignBounty.create).toHaveBeenCalledTimes(2);
    });

    it('should log warning if adding bounties exceeds goal', async () => {
      const dto: AddBountiesCampaignDto = {
        campaignId: 'campaign-123',
        bountyIds: Array(20).fill('bounty-'),
      };

      const mockCampaign = {
        id: '123',
        campaignId: 'campaign-123',
        goal: 10,
        bounties: Array(5).fill({}),
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaignBounty.create.mockResolvedValue({});

      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      await service.addBountiesToCampaign(dto);

      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('setFeaturedBounties', () => {
    it('should set featured bounties when all exist in campaign', async () => {
      const mockCampaign = {
        id: '123',
        campaignId: 'campaign-123',
        featuredBounties: [],
        bounties: [
          { bountyId: 'bounty-1' },
          { bountyId: 'bounty-2' },
        ],
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        featuredBounties: ['bounty-1', 'bounty-2'],
      });

      const result = await service.setFeaturedBounties({
        campaignId: 'campaign-123',
        featuredBountyIds: ['bounty-1', 'bounty-2'],
      });

      expect(result.featuredBounties).toEqual(['bounty-1', 'bounty-2']);
    });

    it('should throw error if more than 5 featured bounties', async () => {
      const mockCampaign = {
        campaignId: 'campaign-123',
        bounties: Array(10).fill({}),
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);

      await expect(
        service.setFeaturedBounties({
          campaignId: 'campaign-123',
          featuredBountyIds: Array(6).fill('bounty-'),
        }),
      ).rejects.toThrow('Maximum 5 featured bounties allowed');
    });
  });

  describe('transitionCampaignStatus', () => {
    it('should transition pending campaign to active when start date passed', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 1000000);

      const mockCampaign = {
        campaignId: 'campaign-123',
        status: 'pending',
        startDate: pastDate,
        endDate: futureDate,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        status: 'active',
      });

      const result = await service.transitionCampaignStatus('campaign-123');

      expect(result.status).toBe('active');
      expect(mockPrismaService.campaign.update).toHaveBeenCalled();
    });

    it('should transition active campaign to completed when end date passed', async () => {
      const pastDate = new Date(Date.now() - 1000000);
      const veryPastDate = new Date(Date.now() - 1000);

      const mockCampaign = {
        campaignId: 'campaign-123',
        status: 'active',
        startDate: pastDate,
        endDate: veryPastDate,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        status: 'completed',
      });

      const result = await service.transitionCampaignStatus('campaign-123');

      expect(result.status).toBe('completed');
    });
  });

  describe('getLeaderboard', () => {
    it('should return top 10 contributors sorted by earnings', async () => {
      const mockCampaign = {
        campaignId: 'campaign-123',
      };

      const mockLeaderboard = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `entry-${i}`,
          contributorId: `contributor-${i}`,
          earnings: (5 - i) * 100,
          completions: 5 - i,
          bonus: i < 3 ? [15, 10, 5][i] : 0,
          rank: i < 3 ? i + 1 : 0,
        }));

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.leaderboardEntry.findMany.mockResolvedValue(mockLeaderboard);

      const result = await service.getLeaderboard('campaign-123');

      expect(result).toHaveLength(5);
      expect(result[0].earnings).toBe(500);
      expect(result[0].rank).toBe(1);
    });
  });

  describe('recalculateBonuses', () => {
    it('should assign 15%, 10%, 5% bonuses to top 3', async () => {
      const mockCampaign = {
        campaignId: 'campaign-123',
      };

      const mockLeaderboard = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `entry-${i}`,
          contributorId: `contributor-${i}`,
          earnings: (5 - i) * 100,
          completions: 5 - i,
          bonus: 0,
          rank: 0,
        }));

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.leaderboardEntry.findMany.mockResolvedValue(mockLeaderboard);
      mockPrismaService.leaderboardEntry.update.mockResolvedValue({});

      await service.recalculateBonuses('campaign-123');

      expect(mockPrismaService.leaderboardEntry.update).toHaveBeenCalledTimes(5);
      // Verify first call has 15% bonus
      expect(mockPrismaService.leaderboardEntry.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({ bonus: 15, rank: 1 }),
        }),
      );
    });
  });

  describe('archiveOldCampaigns', () => {
    it('should archive campaigns completed more than 30 days ago', async () => {
      mockPrismaService.campaign.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.archiveOldCampaigns(30);

      expect(result).toBe(3);
      expect(mockPrismaService.campaign.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'completed',
            endDate: { lt: expect.any(Date) },
          },
          data: { status: 'archived' },
        }),
      );
    });
  });

  describe('getCampaignStats', () => {
    it('should calculate campaign statistics', async () => {
      const mockCampaign = {
        campaignId: 'campaign-123',
        name: 'Q4 DevOps Push',
        status: 'active',
        startDate: new Date(Date.now() - 1000000),
        endDate: new Date(Date.now() + 1000000),
        goal: 50,
        bounties: Array(30).fill({}),
        leaderboard: [
          { earnings: 1000, completions: 5 },
          { earnings: 800, completions: 4 },
          { earnings: 600, completions: 3 },
        ],
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);

      const result = await service.getCampaignStats('campaign-123');

      expect(result.campaignId).toBe('campaign-123');
      expect(result.bountyCount).toBe(30);
      expect(result.contributorCount).toBe(3);
      expect(result.progress).toBe('30/50');
      expect(result.totalEarnings).toBe(2400);
      expect(result.totalCompletions).toBe(12);
      expect(result.daysRemaining).toBeGreaterThan(0);
    });
  });
});
