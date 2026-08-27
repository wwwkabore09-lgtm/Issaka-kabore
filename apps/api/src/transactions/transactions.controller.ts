import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { GetSummaryQueryDto } from './dto/get-summary-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser() userId: string, @Query() query: ListTransactionsQueryDto) {
    return this.transactionsService.findAll(userId, query);
  }

  @Get('summary')
  getSummary(@CurrentUser() userId: string, @Query() query: GetSummaryQueryDto) {
    if (query.accountId) {
      return this.transactionsService.getSummary(query.accountId, userId, query.from, query.to);
    }
    return this.transactionsService.getUserSummary(userId, query.from, query.to);
  }

  @Get('revenue-overview')
  getRevenueOverview(@CurrentUser() userId: string) {
    return this.transactionsService.getRevenueOverview(userId);
  }

  @Get('dashboard-overview')
  getDashboardOverview(@CurrentUser() userId: string) {
    return this.transactionsService.getDashboardOverview(userId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionsService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string) {
    return this.transactionsService.remove(id, userId);
  }
}
