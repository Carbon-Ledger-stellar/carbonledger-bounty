import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma.service';

describe('Support Ticket System Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Clean up test data
    await prisma.supportTicket.deleteMany({});
    await prisma.supportMetrics.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Ticket Lifecycle', () => {
    let ticketId: string;
    const mockJWT =
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwdWJsaWNLZXkiOiJ0ZXN0LWNvbnRyaWJ1dG9yIn0.signature';

    it('should create a new support ticket', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .set('Authorization', mockJWT)
        .send({
          bountyId: 'bounty-123',
          type: 'unclear-requirement',
          title: 'Requirements are unclear',
          description: 'Need more details about acceptance criteria',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('ticketId');
      expect(response.body.status).toBe('open');

      ticketId = response.body.ticketId;
    });

    it('should retrieve the created ticket', async () => {
      const response = await request(app.getHttpServer()).get(
        `/api/v1/support/tickets/${ticketId}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.ticketId).toBe(ticketId);
      expect(response.body.status).toBe('open');
    });

    it('should get all tickets', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/support/tickets',
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get open tickets for dashboard', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/support/tickets/status/open',
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((t: any) => t.ticketId === ticketId)).toBe(
        true,
      );
    });

    it('should update ticket to in-progress', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/support/tickets/${ticketId}`)
        .set('Authorization', mockJWT)
        .send({
          status: 'in-progress',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('in-progress');
      expect(response.body.acknowledgedAt).toBeDefined();
    });

    it('should resolve the ticket', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/support/tickets/${ticketId}`)
        .set('Authorization', mockJWT)
        .send({
          status: 'resolved',
          resolution: 'Updated requirements documentation with clear criteria',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('resolved');
      expect(response.body.resolvedAt).toBeDefined();
      expect(response.body.resolution).toBe(
        'Updated requirements documentation with clear criteria',
      );
    });
  });

  describe('Metrics Tracking', () => {
    it('should track metrics when tickets are created', async () => {
      // Create multiple tickets of different types
      await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .set('Authorization', 'Bearer token')
        .send({
          bountyId: 'bounty-456',
          type: 'blocker-bug',
          title: 'Critical bug',
          description: 'Application crashes',
        });

      await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .set('Authorization', 'Bearer token')
        .send({
          bountyId: 'bounty-456',
          type: 'blocker-bug',
          title: 'Another critical bug',
          description: 'Database connection fails',
        });

      const response = await request(app.getHttpServer()).get(
        '/api/v1/support/metrics',
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const blockerMetric = response.body.find(
        (m: any) => m.ticketType === 'blocker-bug',
      );
      expect(blockerMetric).toBeDefined();
      expect(blockerMetric.frequency).toBeGreaterThan(0);
    });

    it('should get metrics by type', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/support/metrics/blocker-bug',
      );

      expect(response.status).toBe(200);
      expect(response.body.ticketType).toBe('blocker-bug');
      expect(response.body).toHaveProperty('frequency');
      expect(response.body).toHaveProperty('avgResolution');
    });
  });

  describe('Statistics and Filtering', () => {
    it('should get overall statistics', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/support/statistics',
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalTickets');
      expect(response.body).toHaveProperty('openTickets');
      expect(response.body).toHaveProperty('inProgressTickets');
      expect(response.body).toHaveProperty('resolvedTickets');
      expect(response.body).toHaveProperty('avgTimeToAcknowledge');
      expect(response.body).toHaveProperty('ticketsByType');
    });

    it('should filter tickets by bounty', async () => {
      // Create a ticket for a specific bounty
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .set('Authorization', 'Bearer token')
        .send({
          bountyId: 'unique-bounty-789',
          type: 'scope-creep',
          title: 'Scope expanded',
          description: 'New requirements added',
        });

      expect(createResponse.status).toBe(201);

      // Filter by that bounty
      const filterResponse = await request(app.getHttpServer()).get(
        '/api/v1/support/bounty/unique-bounty-789/tickets',
      );

      expect(filterResponse.status).toBe(200);
      expect(Array.isArray(filterResponse.body)).toBe(true);
      expect(
        filterResponse.body.some((t: any) => t.bountyId === 'unique-bounty-789'),
      ).toBe(true);
    });

    it('should filter tickets by status', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/support/tickets?status=open',
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((ticket: any) => {
        expect(ticket.status).toBe('open');
      });
    });

    it('should filter tickets by type', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/support/tickets?type=access-issue',
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent ticket', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/support/tickets/non-existent-ticket',
      );

      expect(response.status).toBe(404);
    });

    it('should reject invalid status on update', async () => {
      // First, create a ticket
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/support/tickets')
        .set('Authorization', 'Bearer token')
        .send({
          bountyId: 'bounty-error-test',
          type: 'unclear-requirement',
          title: 'Test ticket',
          description: 'For error testing',
        });

      const ticketId = createResponse.body.ticketId;

      // Try to update with invalid status
      const updateResponse = await request(app.getHttpServer())
        .put(`/api/v1/support/tickets/${ticketId}`)
        .set('Authorization', 'Bearer token')
        .send({
          status: 'invalid-status',
        });

      expect(updateResponse.status).toBe(400);
    });
  });
});
