import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { CreditsModule } from './credits/credits.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { RetirementsModule } from './retirements/retirements.module';
import { OracleModule } from './oracle/oracle.module';
import { StatsModule } from './stats/stats.module';
import { FraudModule } from './fraud/fraud.module';
import { FeedModule } from './feed/feed.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { MatchingModule } from './matching/matching.module';
import { DisputeModule } from './disputes/dispute.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me-in-production',
      signOptions: { expiresIn: (process.env.JWT_EXPIRY || '7d') as SignOptions['expiresIn'] },
    }),
    AuthModule,
    ProjectsModule,
    CreditsModule,
    MarketplaceModule,
    RetirementsModule,
    OracleModule,
    StatsModule,
    FraudModule,
    FeedModule,
    PortfolioModule,
    MatchingModule,
    DisputeModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
