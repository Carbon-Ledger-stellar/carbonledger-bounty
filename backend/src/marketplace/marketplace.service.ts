import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateListingDto, PurchaseDto } from './marketplace.dto';

@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    methodology?: string;
    vintage?: number;
    country?: string;
    minPrice?: bigint;
    maxPrice?: bigint;
  }) {
    return this.prisma.marketListing.findMany({
      where: {
        status: { in: ['Active', 'PartiallyFilled'] },
        ...(filters.methodology && { methodology: filters.methodology }),
        ...(filters.vintage && { vintageYear: filters.vintage }),
        ...(filters.country && { country: filters.country }),
      },
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(listingId: string) {
    const listing = await this.prisma.marketListing.findUnique({
      where: { listingId },
      include: { project: true },
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    return listing;
  }

  async createListing(dto: CreateListingDto) {
    // Verify batch exists
    const batch = await this.prisma.creditBatch.findUnique({
      where: { batchId: dto.batchId },
      include: { project: true },
    });

    if (!batch) {
      throw new NotFoundException(`Batch ${dto.batchId} not found`);
    }

    if (dto.amount > batch.amount) {
      throw new BadRequestException('Listing amount exceeds batch amount');
    }

    // Generate listing ID
    const listingId = `list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const listing = await this.prisma.marketListing.create({
      data: {
        listingId,
        projectId: batch.projectId,
        batchId: dto.batchId,
        seller: 'SELLER_ADDRESS', // Set from auth context
        amountAvailable: dto.amount,
        pricePerCredit: dto.pricePerCredit,
        vintageYear: batch.vintageYear,
        methodology: batch.project.methodology,
        country: batch.project.country,
        status: 'Active',
      },
    });

    return listing;
  }

  async delistListing(listingId: string) {
    const listing = await this.prisma.marketListing.findUnique({
      where: { listingId },
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    return this.prisma.marketListing.update({
      where: { listingId },
      data: { status: 'Delisted' },
    });
  }

  async purchase(dto: PurchaseDto) {
    const listing = await this.prisma.marketListing.findUnique({
      where: { listingId: dto.listingId },
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${dto.listingId} not found`);
    }

    if (listing.status === 'Sold' || listing.status === 'Delisted') {
      throw new BadRequestException('Listing is not available');
    }

    if (dto.amount > listing.amountAvailable) {
      throw new BadRequestException('Insufficient credits in listing');
    }

    // Calculate total cost
    const totalCost = BigInt(dto.amount) * BigInt(listing.pricePerCredit);

    // Update listing
    const newAmount = listing.amountAvailable - dto.amount;
    const newStatus = newAmount === 0 ? 'Sold' : 'PartiallyFilled';

    await this.prisma.marketListing.update({
      where: { listingId: dto.listingId },
      data: {
        amountAvailable: newAmount,
        status: newStatus,
      },
    });

    return {
      listingId: dto.listingId,
      amount: dto.amount,
      totalCost: totalCost.toString(),
      buyer: dto.buyerKey,
      status: 'completed',
      batchId: listing.batchId,
    };
  }
}
