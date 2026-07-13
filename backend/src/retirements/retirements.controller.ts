import { Controller, Get, Param } from '@nestjs/common';
import { RetirementsService } from './retirements.service';

@Controller('api/v1/retirements')
export class RetirementsController {
  constructor(private retirementsService: RetirementsService) {}

  @Get()
  async getAll() {
    return this.retirementsService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') retirementId: string) {
    return this.retirementsService.findOne(retirementId);
  }
}
