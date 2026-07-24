import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { EscrowScheduler } from './escrow.scheduler';
import { MilestoneController } from './milestone.controller';
import { PrismaService } from '../prisma.service';

/**
 * EscrowModule
 *
 * Provides the full milestone-based escrow payment system:
 *  - EscrowService     — state machine, payment logic, audit trail
 *  - EscrowScheduler   — hourly poller for auto-release on reviewer timeout
 *  - MilestoneController — REST API at /api/v1/bounties/:bountyId/escrow/...
 *
 * EscrowService is exported so other modules (e.g. BountyVersioningModule)
 * can query escrow state without going through HTTP.
 */
@Module({
  controllers: [MilestoneController],
  providers: [PrismaService, EscrowService, EscrowScheduler],
  exports: [EscrowService],
})
export class EscrowModule {}
