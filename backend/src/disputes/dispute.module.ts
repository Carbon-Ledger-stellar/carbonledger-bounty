import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DisputeService } from './dispute.service';
import { DisputeController } from './dispute.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [DisputeController],
  providers: [DisputeService, PrismaService],
  exports: [DisputeService],
})
export class DisputeModule {}
