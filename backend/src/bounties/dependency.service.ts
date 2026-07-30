import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CreateDependencyDto {
  prerequisiteBountyId: string;
  dependentBountyId: string;
  isRequired?: boolean;
}

export interface RemoveDependencyDto {
  prerequisiteBountyId: string;
  dependentBountyId: string;
}

@Injectable()
export class DependencyService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new dependency between two bounties
   */
  async createDependency(createDto: CreateDependencyDto) {
    // Validate both bounties exist
    const [prerequisite, dependent] = await Promise.all([
      this.prisma.bounty.findUnique({ where: { id: createDto.prerequisiteBountyId } }),
      this.prisma.bounty.findUnique({ where: { id: createDto.dependentBountyId } })
    ]);

    if (!prerequisite) {
      throw new NotFoundException(`Prerequisite bounty ${createDto.prerequisiteBountyId} not found`);
    }
    
    if (!dependent) {
      throw new NotFoundException(`Dependent bounty ${createDto.dependentBountyId} not found`);
    }

    // Prevent self-dependencies
    if (createDto.prerequisiteBountyId === createDto.dependentBountyId) {
      throw new BadRequestException('A bounty cannot depend on itself');
    }

    // Check for circular dependencies
    await this.validateNoCycles(createDto.prerequisiteBountyId, createDto.dependentBountyId);

    // Create the dependency
    return await this.prisma.bountyDependency.create({
      data: {
        prerequisiteBountyId: createDto.prerequisiteBountyId,
        dependentBountyId: createDto.dependentBountyId,
        isRequired: createDto.isRequired ?? true
      },
      include: {
        prerequisiteBounty: true,
        dependentBounty: true
      }
    });
  }

  /**
   * Remove a dependency between two bounties
   */
  async removeDependency(removeDto: RemoveDependencyDto) {
    const dependency = await this.prisma.bountyDependency.findUnique({
      where: {
        prerequisiteBountyId_dependentBountyId: {
          prerequisiteBountyId: removeDto.prerequisiteBountyId,
          dependentBountyId: removeDto.dependentBountyId
        }
      }
    });

    if (!dependency) {
      throw new NotFoundException('Dependency not found');
    }

    await this.prisma.bountyDependency.delete({
      where: { id: dependency.id }
    });

    return { message: 'Dependency removed successfully' };
  }

  /**
   * Check if a bounty is locked due to unmet prerequisites
   */
  async isBountyLocked(bountyId: string): Promise<boolean> {
    const prerequisites = await this.prisma.bountyDependency.findMany({
      where: { 
        dependentBountyId: bountyId,
        isRequired: true // Only check required prerequisites
      },
      include: {
        prerequisiteBounty: true
      }
    });

    // If no required prerequisites, bounty is not locked
    if (prerequisites.length === 0) {
      return false;
    }

    // Check if all required prerequisites are completed
    const uncompletedPrerequisites = prerequisites.filter(
      dep => dep.prerequisiteBounty.status !== 'closed'
    );

    return uncompletedPrerequisites.length > 0;
  }

  /**
   * Auto-unlock dependent bounties when a bounty is completed
   */
  async unlockDependentBounties(completedBountyId: string) {
    const dependents = await this.prisma.bountyDependency.findMany({
      where: { prerequisiteBountyId: completedBountyId },
      include: {
        dependentBounty: true
      }
    });

    const unlockedBounties = [];

    for (const dependency of dependents) {
      const isNowUnlocked = !(await this.isBountyLocked(dependency.dependentBountyId));
      
      if (isNowUnlocked && dependency.dependentBounty.status === 'open') {
        unlockedBounties.push({
          id: dependency.dependentBountyId,
          title: dependency.dependentBounty.title
        });
      }
    }

    return unlockedBounties;
  }

  /**
   * Validate that creating a dependency won't create a cycle
   */
  private async validateNoCycles(prerequisiteId: string, dependentId: string) {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = async (currentId: string): Promise<boolean> => {
      if (recursionStack.has(currentId)) {
        return true; // Cycle detected
      }

      if (visited.has(currentId)) {
        return false; // Already processed this node
      }

      visited.add(currentId);
      recursionStack.add(currentId);

      // Get all dependencies where current bounty is a prerequisite
      const dependencies = await this.prisma.bountyDependency.findMany({
        where: { prerequisiteBountyId: currentId }
      });

      // Check if any of the dependents lead to a cycle
      for (const dep of dependencies) {
        if (await hasCycle(dep.dependentBountyId)) {
          return true;
        }
      }

      // Also check the new dependency we're trying to add
      if (currentId === prerequisiteId && dependentId === prerequisiteId) {
        return true;
      }

      recursionStack.delete(currentId);
      return false;
    };

    // Start cycle detection from the dependent bounty to see if it eventually leads back to prerequisite
    if (await hasCycle(dependentId)) {
      throw new BadRequestException('Creating this dependency would create a circular dependency');
    }
  }
}
