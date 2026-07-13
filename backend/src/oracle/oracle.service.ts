import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubmitMonitoringDto } from './oracle.dto';

@Injectable()
export class OracleService {
  constructor(private prisma: PrismaService) {}

  async submitMonitoring(dto: SubmitMonitoringDto) {
    // Verify project exists
    const project = await this.prisma.carbonProject.findUnique({
      where: { projectId: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    return this.prisma.monitoringData.create({
      data: {
        projectId: dto.projectId,
        period: dto.period,
        tonnesVerified: dto.tonnesVerified,
        methodologyScore: dto.methodologyScore,
        satelliteCid: dto.satelliteCid,
        submittedBy: 'ORACLE_ADDRESS', // Set from auth context
      },
    });
  }

  async getStatus(projectId: string) {
    const project = await this.prisma.carbonProject.findUnique({
      where: { projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const monitoring = await this.prisma.monitoringData.findFirst({
      where: { projectId },
      orderBy: { submittedAt: 'desc' },
    });

    if (!monitoring) {
      return {
        projectId,
        status: 'no_monitoring_data',
        lastUpdated: null,
        freshness: 'unknown',
      };
    }

    // Check if monitoring data is fresh (≤ 365 days old)
    const daysSinceUpdate = (Date.now() - monitoring.submittedAt.getTime()) / (1000 * 60 * 60 * 24);
    const isFresh = daysSinceUpdate <= 365;

    return {
      projectId,
      status: 'monitoring_current',
      lastUpdated: monitoring.submittedAt,
      freshness: isFresh ? 'current' : 'stale',
      daysSinceUpdate: Math.floor(daysSinceUpdate),
      methodologyScore: monitoring.methodologyScore,
    };
  }
}
