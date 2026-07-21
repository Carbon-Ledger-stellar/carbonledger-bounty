import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SupportTicketService } from './support-ticket.service';
import { CreateSupportTicketDto, UpdateSupportTicketDto } from './support.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/v1/support')
export class SupportTicketController {
  constructor(private supportService: SupportTicketService) {}

  /**
   * Create a new support ticket (contributor)
   */
  @Post('tickets')
  @UseGuards(AuthGuard('jwt'))
  async createTicket(@Body() dto: CreateSupportTicketDto, @Request() req) {
    return this.supportService.createTicket(dto, req.user.publicKey);
  }

  /**
   * Get all support tickets (with optional filters)
   */
  @Get('tickets')
  async getAllTickets(
    @Query('bountyId') bountyId?: string,
    @Query('contributorId') contributorId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.supportService.findAll({
      bountyId,
      contributorId,
      status,
      type,
    });
  }

  /**
   * Get a single ticket by ID
   */
  @Get('tickets/:ticketId')
  async getTicket(@Param('ticketId') ticketId: string) {
    return this.supportService.findOne(ticketId);
  }

  /**
   * Update a support ticket (maintainer acknowledges or resolves)
   */
  @Put('tickets/:ticketId')
  @UseGuards(AuthGuard('jwt'))
  async updateTicket(
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateSupportTicketDto,
    @Request() req,
  ) {
    // Set maintainerId to the current user if updating status
    if (dto.status && !dto.maintainerId) {
      dto.maintainerId = req.user.publicKey;
    }
    return this.supportService.updateTicket(ticketId, dto);
  }

  /**
   * Get all open tickets for maintainer dashboard
   */
  @Get('tickets/status/open')
  async getOpenTickets() {
    return this.supportService.findOpenTickets();
  }

  /**
   * Get tickets for a specific bounty (transparency for bounty creator)
   */
  @Get('bounty/:bountyId/tickets')
  async getTicketsByBounty(@Param('bountyId') bountyId: string) {
    return this.supportService.getTicketsByBounty(bountyId);
  }

  /**
   * Get support metrics/statistics
   */
  @Get('metrics')
  async getMetrics() {
    return this.supportService.getMetrics();
  }

  /**
   * Get metrics for a specific ticket type
   */
  @Get('metrics/:type')
  async getMetricsByType(@Param('type') type: string) {
    return this.supportService.getMetricsByType(type);
  }

  /**
   * Get overall support statistics
   */
  @Get('statistics')
  async getStatistics() {
    return this.supportService.getStatistics();
  }
}
