import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MarketplaceService } from './marketplace.service';
import { CreateListingDto, PurchaseDto } from './marketplace.dto';

@Controller('api/v1/marketplace')
export class MarketplaceController {
  constructor(private marketplaceService: MarketplaceService) {}

  @Get('listings')
  async getListings(
    @Query('methodology') methodology?: string,
    @Query('vintage') vintage?: string,
    @Query('country') country?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
  ) {
    return this.marketplaceService.findAll({
      methodology,
      vintage: vintage ? Number(vintage) : undefined,
      country,
      minPrice: minPrice ? BigInt(minPrice) : undefined,
      maxPrice: maxPrice ? BigInt(maxPrice) : undefined,
    });
  }

  @Get('listings/:id')
  async getListing(@Param('id') listingId: string) {
    return this.marketplaceService.findOne(listingId);
  }

  @Post('list')
  @UseGuards(AuthGuard('jwt'))
  async createListing(@Body() dto: CreateListingDto) {
    return this.marketplaceService.createListing(dto);
  }

  @Delete('listings/:id')
  @UseGuards(AuthGuard('jwt'))
  async delistListing(@Param('id') listingId: string) {
    return this.marketplaceService.delistListing(listingId);
  }

  @Post('purchase')
  @UseGuards(AuthGuard('jwt'))
  async purchase(@Body() dto: PurchaseDto) {
    return this.marketplaceService.purchase(dto);
  }
}
