import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser() userId: string) {
    return this.goalsService.findAllForUser(userId);
  }

  @Get('savings-overview')
  getSavingsOverview(@CurrentUser() userId: string) {
    return this.goalsService.getSavingsOverview(userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string) {
    return this.goalsService.findOneForUser(id, userId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string, @Body() dto: UpdateGoalDto) {
    return this.goalsService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string) {
    await this.goalsService.remove(id, userId);
  }

  @Get(':id/contributions')
  listContributions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string) {
    return this.goalsService.listContributions(id, userId);
  }

  @Post(':id/contributions')
  addContribution(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateContributionDto,
  ) {
    return this.goalsService.addContribution(id, userId, dto);
  }
}
