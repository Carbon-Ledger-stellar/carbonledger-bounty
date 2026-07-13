import { Controller, Get, Post, Put, Body, Param, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';
import { RegisterProjectDto, VerifyProjectDto } from './projects.dto';

@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  async getAll(
    @Query('methodology') methodology?: string,
    @Query('country') country?: string,
    @Query('status') status?: string,
  ) {
    return this.projectsService.findAll({
      methodology,
      country,
      status,
    });
  }

  @Get(':id')
  async getOne(@Param('id') projectId: string) {
    return this.projectsService.findOne(projectId);
  }

  @Post('register')
  @UseGuards(AuthGuard('jwt'))
  async register(@Body() dto: RegisterProjectDto) {
    return this.projectsService.register(dto);
  }

  @Put(':id/verify')
  @UseGuards(AuthGuard('jwt'))
  async verify(@Param('id') projectId: string) {
    return this.projectsService.verify(projectId);
  }
}
