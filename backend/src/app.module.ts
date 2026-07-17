import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { CreditsModule } from './credits/credits.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { RetirementsModule } from './retirements/retirements.module';
import { OracleModule } from './oracle/oracle.module';
import { StatsModule } from './stats/stats.module';
import { FraudModule } from './fraud/fraud.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me-in-production',
      signOptions: { expiresIn: process.env.JWT_EXPIRY || '7d' },
    }),
    AuthModule,
    ProjectsModule,
    CreditsModule,
    MarketplaceModule,
    RetirementsModule,
    OracleModule,
    StatsModule,
    FraudModule,
    CampaignsModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
