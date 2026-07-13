import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RetirementsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.retirementRecord.findMany({
      include: {
        batch: true,
        project: true,
      },
      orderBy: { retiredAt: 'desc' },
    });
  }

  async findOne(retirementId: string) {
    const retirement = await this.prisma.retirementRecord.findUnique({
      where: { retirementId },
      include: {
        batch: true,
        project: true,
      },
    });

    if (!retirement) {
      throw new NotFoundException(`Retirement ${retirementId} not found`);
    }

    return retirement;
  }
}
