import { Module } from '@nestjs/common';
import { QualityGatesService } from './quality-gates.service';
import { QualityController } from './quality.controller';

@Module({
  controllers: [QualityController],
  providers: [QualityGatesService],
  exports: [QualityGatesService],
})
export class QualityModule {}
