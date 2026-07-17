import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSupportTicketDto, UpdateSupportTicketDto } from './support.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SupportTicketService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new support ticket
   */
  async createTicket(
    dto: CreateSupportTicketDto,
    contributorId: string,
  ) {
    const ticketId = `ticket-${uuidv4()}`;

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketId,
        bountyId: dto.bountyId,
        contributorId,
        type: dto.type,
        status: 'open',
        title: dto.title,
        description: dto.description,
        attachments: dto.attachments || [],
      },
    });

    // Update metrics for this ticket type
    await this.updateMetrics(dto.type, 'increment');

    return ticket;
  }

  /**
   * Get all tickets (optionally filtered)
   */
  async findAll(filters?: {
    bountyId?: string;
    contributorId?: string;
    status?: string;
    type?: string;
  }) {
    return this.prisma.supportTicket.findMany({
      where: {
        ...(filters?.bountyId && { bountyId: filters.bountyId }),
        ...(filters?.contributorId && { contributorId: filters.contributorId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.type && { type: filters.type }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single ticket by ID
   */
  async findOne(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket ${ticketId} not found`);
    }

    return ticket;
  }

  /**
   * Update a support ticket (maintainer acknowledges or resolves)
   */
  async updateTicket(ticketId: string, dto: UpdateSupportTicketDto) {
    const ticket = await this.findOne(ticketId);

    // Validation: can't transition to invalid states
    if (
      dto.status &&
      ['open', 'in-progress', 'resolved'].indexOf(dto.status) === -1
    ) {
      throw new BadRequestException('Invalid ticket status');
    }

    // Handle status transitions
    const updateData: any = {
      status: dto.status || ticket.status,
      maintainerId: dto.maintainerId || ticket.maintainerId,
      resolution: dto.resolution || ticket.resolution,
    };

    // When first transitioning out of 'open', set acknowledgedAt
    if (ticket.status === 'open' && dto.status && dto.status !== 'open') {
      updateData.acknowledgedAt = new Date();
    }

    // When transitioning to 'resolved', set resolvedAt
    if (dto.status === 'resolved' && ticket.status !== 'resolved') {
      updateData.resolvedAt = new Date();

      // Update resolution time metrics
      const resolutionTimeHours = Math.floor(
        (new Date().getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60),
      );
      await this.updateResolutionMetrics(ticket.type, resolutionTimeHours);
    }

    return this.prisma.supportTicket.update({
      where: { ticketId },
      data: updateData,
    });
  }

  /**
   * Get all open tickets (for maintainer dashboard)
   */
  async findOpenTickets() {
    return this.prisma.supportTicket.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get tickets by bounty for transparency (visible to bounty creator)
   */
  async getTicketsByBounty(bountyId: string) {
    return this.prisma.supportTicket.findMany({
      where: { bountyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get support metrics
   */
  async getMetrics() {
    return this.prisma.supportMetrics.findMany({
      orderBy: { frequency: 'desc' },
    });
  }

  /**
   * Get metrics for a specific ticket type
   */
  async getMetricsByType(type: string) {
    return this.prisma.supportMetrics.findUnique({
      where: { ticketType: type },
    });
  }

  /**
   * Private helper: Update frequency metrics
   */
  private async updateMetrics(type: string, action: 'increment' | 'decrement') {
    let metrics = await this.prisma.supportMetrics.findUnique({
      where: { ticketType: type },
    });

    if (!metrics) {
      metrics = await this.prisma.supportMetrics.create({
        data: {
          ticketType: type,
          frequency: 1,
        },
      });
    } else {
      await this.prisma.supportMetrics.update({
        where: { ticketType: type },
        data: {
          frequency:
            action === 'increment'
              ? metrics.frequency + 1
              : Math.max(0, metrics.frequency - 1),
        },
      });
    }
  }

  /**
   * Private helper: Update resolution time metrics
   */
  private async updateResolutionMetrics(type: string, resolutionHours: number) {
    let metrics = await this.prisma.supportMetrics.findUnique({
      where: { ticketType: type },
    });

    if (!metrics) {
      metrics = await this.prisma.supportMetrics.create({
        data: {
          ticketType: type,
          frequency: 0,
          avgResolution: resolutionHours,
        },
      });
    } else {
      // Calculate new average: (old_avg * old_count + new_time) / (old_count + 1)
      // For simplicity, we'll store the total and count separately in a production system
      const totalTickets = metrics.frequency;
      const newAvg = Math.floor(
        (metrics.avgResolution * totalTickets + resolutionHours) /
          (totalTickets + 1),
      );

      await this.prisma.supportMetrics.update({
        where: { ticketType: type },
        data: {
          avgResolution: newAvg,
        },
      });
    }
  }

  /**
   * Get statistics about support tickets
   */
  async getStatistics() {
    const totalTickets = await this.prisma.supportTicket.count();
    const openTickets = await this.prisma.supportTicket.count({
      where: { status: 'open' },
    });
    const inProgressTickets = await this.prisma.supportTicket.count({
      where: { status: 'in-progress' },
    });
    const resolvedTickets = await this.prisma.supportTicket.count({
      where: { status: 'resolved' },
    });

    // Calculate average time to acknowledge
    const unacknowledged = await this.prisma.supportTicket.findMany({
      where: { acknowledgedAt: null, status: 'open' },
      orderBy: { createdAt: 'asc' },
    });

    const avgTimeToAcknowledge =
      unacknowledged.length > 0
        ? Math.floor(
            unacknowledged.reduce((sum, ticket) => {
              return (
                sum +
                (new Date().getTime() - ticket.createdAt.getTime()) /
                  (1000 * 60 * 60)
              );
            }, 0) / unacknowledged.length,
          )
        : 0;

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      avgTimeToAcknowledge,
      ticketsByType: await this.getMetrics(),
    };
  }
}
