import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreditsService } from './credits.service';
import { MintCreditsDto, RetireCreditsDto } from './credits.dto';

@Controller('api/v1/credits')
export class CreditsController {
  constructor(private creditsService: CreditsService) {}

  @Post('mint')
  @UseGuards(AuthGuard('jwt'))
  async mint(@Body() dto: MintCreditsDto) {
    return this.creditsService.mint(dto);
  }

  @Get('batch/:id')
  async getBatch(@Param('id') batchId: string) {
    return this.creditsService.getBatch(batchId);
  }

  @Post('retire')
  @UseGuards(AuthGuard('jwt'))
  async retire(@Body() dto: RetireCreditsDto) {
    return this.creditsService.retire(dto);
  }

  @Get('serial/:serial')
  async lookupSerial(@Param('serial') serial: string) {
    return this.creditsService.lookupSerial(serial);
  }
}
