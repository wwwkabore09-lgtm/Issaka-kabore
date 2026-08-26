import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { OwnerQueryDto } from './dto/owner-query.dto';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@Body() dto: CreateGoalDto) {
    return this.goalsService.create(dto);
  }

  @Get()
  findAll(@Query() query: OwnerQueryDto) {
    return this.goalsService.findAllForUser(query.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    return this.goalsService.findOneForUser(id, query.userId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto, @Body() dto: UpdateGoalDto) {
    return this.goalsService.update(id, query.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    await this.goalsService.remove(id, query.userId);
  }

  @Get(':id/contributions')
  listContributions(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    return this.goalsService.listContributions(id, query.userId);
  }

  @Post(':id/contributions')
  addContribution(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateContributionDto) {
    return this.goalsService.addContribution(id, dto);
  }
}
