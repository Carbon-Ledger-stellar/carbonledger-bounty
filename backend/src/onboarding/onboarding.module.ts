import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [OnboardingController],
  providers: [OnboardingService, PrismaService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
