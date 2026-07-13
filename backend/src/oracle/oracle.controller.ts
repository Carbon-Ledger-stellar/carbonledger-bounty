import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OracleService } from './oracle.service';
import { SubmitMonitoringDto } from './oracle.dto';

@Controller('api/v1/oracle')
export class OracleController {
  constructor(private oracleService: OracleService) {}

  @Post('monitoring')
  @UseGuards(AuthGuard('jwt'))
  async submitMonitoring(@Body() dto: SubmitMonitoringDto) {
    return this.oracleService.submitMonitoring(dto);
  }

  @Get('status/:projectId')
  async getStatus(@Param('projectId') projectId: string) {
    return this.oracleService.getStatus(projectId);
  }
}
