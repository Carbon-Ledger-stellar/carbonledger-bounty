import { Module } from '@nestjs/common';
import { SupportTicketService } from './support-ticket.service';
import { SupportTicketController } from './support.controller';
import { PrismaService } from '../prisma.service';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [SupportTicketController],
  providers: [SupportTicketService, PrismaService],
  exports: [SupportTicketService],
})
export class SupportModule {}
