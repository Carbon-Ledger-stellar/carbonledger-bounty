import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const [
      totalProjects,
      verifiedProjects,
      totalCreditsIssued,
      totalCreditsRetired,
      activeListings,
      totalRetirements,
    ] = await Promise.all([
      this.prisma.carbonProject.count(),
      this.prisma.carbonProject.count({ where: { status: 'Verified' } }),
      this.prisma.carbonProject.aggregate({
        _sum: { totalCreditsIssued: true },
      }),
      this.prisma.carbonProject.aggregate({
        _sum: { totalCreditsRetired: true },
      }),
      this.prisma.marketListing.count({
        where: { status: { in: ['Active', 'PartiallyFilled'] } },
      }),
      this.prisma.retirementRecord.count(),
    ]);

    return {
      totalProjects,
      verifiedProjects,
      totalCreditsIssued: totalCreditsIssued._sum?.totalCreditsIssued || 0,
      totalCreditsRetired: totalCreditsRetired._sum?.totalCreditsRetired || 0,
      activeListings,
      totalRetirements,
      retirementRate: totalCreditsIssued._sum?.totalCreditsIssued
        ? Math.round(
            ((totalCreditsRetired._sum?.totalCreditsRetired || 0) /
              totalCreditsIssued._sum.totalCreditsIssued) *
              100,
          )
        : 0,
    };
  }
}
