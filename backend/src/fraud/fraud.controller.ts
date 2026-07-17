import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FraudDetectionService } from './fraud-detection.service';
import {
  CheckFraudDto,
  LinkGithubDto,
  VerifyStellarDto,
  AppealDto,
  ReviewFraudDto,
} from './fraud.dto';

@Controller('api/v1/fraud')
export class FraudController {
  constructor(private fraudService: FraudDetectionService) {}

  /**
   * Run fraud checks for a contributor submission.
   * Protected — called by internal payment/submission flows.
   */
  @Post('check')
  @UseGuards(AuthGuard('jwt'))
  async checkFraud(@Body() dto: CheckFraudDto) {
    return this.fraudService.checkFraud(dto);
  }

  /**
   * Link a GitHub account to improve contributor trust score.
   */
  @Post('identity/github')
  @UseGuards(AuthGuard('jwt'))
  async linkGithub(@Body() dto: LinkGithubDto) {
    return this.fraudService.linkGithub(dto);
  }

  /**
   * Verify a Stellar address via signed challenge.
   */
  @Post('identity/stellar/verify')
  @UseGuards(AuthGuard('jwt'))
  async verifyStellar(@Body() dto: VerifyStellarDto) {
    return this.fraudService.verifyStellarAddress(dto);
  }

  /**
   * Get identity record for a contributor.
   */
  @Get('identity/:contributorId')
  @UseGuards(AuthGuard('jwt'))
  async getIdentity(@Param('contributorId') contributorId: string) {
    return this.fraudService.getIdentity(contributorId);
  }

  /**
   * File an appeal against a fraud decision.
   */
  @Post('appeal')
  @UseGuards(AuthGuard('jwt'))
  async fileAppeal(@Body() dto: AppealDto) {
    return this.fraudService.fileAppeal(dto);
  }

  /**
   * Reviewer resolves a fraud flag. Admin/verifier only.
   */
  @Post('review')
  @UseGuards(AuthGuard('jwt'))
  async reviewFlag(@Body() dto: ReviewFraudDto) {
    return this.fraudService.reviewFraudFlag(dto);
  }

  /**
   * Get audit log. Admin only.
   */
  @Get('audit')
  @UseGuards(AuthGuard('jwt'))
  async getAuditLog(
    @Query('contributorId') contributorId?: string,
    @Query('action') action?: string,
  ) {
    return this.fraudService.getAuditLog({ contributorId, action });
  }
}
