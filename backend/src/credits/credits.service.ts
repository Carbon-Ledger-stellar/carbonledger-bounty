import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MintCreditsDto, RetireCreditsDto } from './credits.dto';

@Injectable()
export class CreditsService {
  constructor(private prisma: PrismaService) {}

  async mint(dto: MintCreditsDto) {
    // Verify project exists and is verified
    const project = await this.prisma.carbonProject.findUnique({
      where: { projectId: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    if (project.status !== 'Verified') {
      throw new BadRequestException('Project must be verified to mint credits');
    }

    // Generate batch ID
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Check serial range overlap
    const serialEnd = String(Number(dto.serialStart) + dto.amount - 1);
    const overlap = await this.prisma.creditBatch.findFirst({
      where: {
        OR: [
          {
            AND: [
              { serialStart: { lte: serialEnd } },
              { serialEnd: { gte: dto.serialStart } },
            ],
          },
        ],
      },
    });

    if (overlap) {
      throw new BadRequestException('Serial number range overlaps existing batch');
    }

    const batch = await this.prisma.creditBatch.create({
      data: {
        batchId,
        projectId: dto.projectId,
        vintageYear: new Date().getFullYear(),
        amount: dto.amount,
        serialStart: dto.serialStart,
        serialEnd,
        metadataCid: dto.metadataCid,
        status: 'Active',
      },
    });

    // Update project issued credits count
    await this.prisma.carbonProject.update({
      where: { projectId: dto.projectId },
      data: {
        totalCreditsIssued: {
          increment: dto.amount,
        },
      },
    });

    return batch;
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.creditBatch.findUnique({
      where: { batchId },
      include: { project: true },
    });

    if (!batch) {
      throw new NotFoundException(`Batch ${batchId} not found`);
    }

    return batch;
  }

  async retire(dto: RetireCreditsDto) {
    // Verify batch exists
    const batch = await this.prisma.creditBatch.findUnique({
      where: { batchId: dto.batchId },
    });

    if (!batch) {
      throw new NotFoundException(`Batch ${dto.batchId} not found`);
    }

    if (batch.status === 'FullyRetired') {
      throw new BadRequestException('Credits already fully retired');
    }

    if (dto.amount > batch.amount) {
      throw new BadRequestException('Insufficient credits to retire');
    }

    // Generate serial numbers
    const serialStart = Number(batch.serialStart);
    const serialNumbers = Array.from({ length: dto.amount }, (_, i) =>
      String(serialStart + i),
    );

    // Generate retirement ID
    const retirementId = `ret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create retirement record
    const retirement = await this.prisma.retirementRecord.create({
      data: {
        retirementId,
        batchId: dto.batchId,
        projectId: dto.projectId,
        amount: dto.amount,
        retiredBy: 'RETIRED_BY_ADDRESS', // Set from auth context
        beneficiary: dto.beneficiary,
        retirementReason: dto.retirementReason,
        vintageYear: batch.vintageYear,
        serialNumbers,
        txHash: 'TX_HASH', // Set from Soroban tx result
      },
    });

    // Update batch status
    const newAmount = batch.amount - dto.amount;
    const newStatus = newAmount === 0 ? 'FullyRetired' : 'PartiallyRetired';

    await this.prisma.creditBatch.update({
      where: { batchId: dto.batchId },
      data: {
        amount: newAmount,
        status: newStatus,
      },
    });

    // Update project retired credits count
    await this.prisma.carbonProject.update({
      where: { projectId: dto.projectId },
      data: {
        totalCreditsRetired: {
          increment: dto.amount,
        },
      },
    });

    return retirement;
  }

  async lookupSerial(serial: string) {
    // Parse serial format: PROJ-2024-001-000042
    const parts = serial.split('-');
    if (parts.length < 4) {
      throw new BadRequestException('Invalid serial format');
    }

    const serialNumber = Number(parts[3]);

    // Find batch containing this serial
    const batch = await this.prisma.creditBatch.findFirst({
      where: {
        AND: [
          { serialStart: { lte: String(serialNumber) } },
          { serialEnd: { gte: String(serialNumber) } },
        ],
      },
      include: { project: true },
    });

    if (!batch) {
      throw new NotFoundException(`Serial ${serial} not found`);
    }

    // Check if retired
    const retirement = await this.prisma.retirementRecord.findFirst({
      where: {
        serialNumbers: {
          has: serial,
        },
      },
    });

    return {
      serial,
      batch,
      retirement: retirement || null,
      status: retirement ? 'Retired' : 'Active',
    };
  }
}
