import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { ListBudgetsQueryDto } from './dto/list-budgets-query.dto';
import { OwnerQueryDto } from './dto/owner-query.dto';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  create(@Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListBudgetsQueryDto) {
    return this.budgetsService.findAllWithProgress(query.accountId, query.userId, query.from, query.to);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto, @Body() dto: UpdateBudgetDto) {
    return this.budgetsService.update(id, query.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    await this.budgetsService.remove(id, query.userId);
  }
}
