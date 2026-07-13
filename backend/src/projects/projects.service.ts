import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RegisterProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async register(dto: RegisterProjectDto) {
    // Generate project ID
    const projectId = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return this.prisma.carbonProject.create({
      data: {
        projectId,
        name: dto.name,
        methodology: dto.methodology,
        country: dto.country,
        projectType: dto.projectType,
        metadataCid: dto.metadataCid,
        verifierAddress: dto.verifierAddress,
        vintageYear: dto.vintageYear,
        status: 'Pending',
        ownerAddress: 'OWNER_ADDRESS', // Set from auth context
      },
    });
  }

  async verify(projectId: string) {
    const project = await this.prisma.carbonProject.findUnique({
      where: { projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return this.prisma.carbonProject.update({
      where: { projectId },
      data: { status: 'Verified' },
    });
  }

  async findOne(projectId: string) {
    const project = await this.prisma.carbonProject.findUnique({
      where: { projectId },
      include: {
        batches: true,
        retirements: true,
        monitoring: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    return project;
  }

  async findAll(filters: {
    methodology?: string;
    country?: string;
    status?: string;
  }) {
    return this.prisma.carbonProject.findMany({
      where: {
        ...(filters.methodology && { methodology: filters.methodology }),
        ...(filters.country && { country: filters.country }),
        ...(filters.status && { status: filters.status }),
      },
      include: {
        batches: true,
        monitoring: { take: 1, orderBy: { submittedAt: 'desc' } },
      },
    });
  }
}
