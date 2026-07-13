import { Module } from '@nestjs/common';
import { OracleService } from './oracle.service';
import { OracleController } from './oracle.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [OracleController],
  providers: [OracleService, PrismaService],
  exports: [OracleService],
})
export class OracleModule {}
