import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { GetSummaryQueryDto } from './dto/get-summary-query.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListTransactionsQueryDto) {
    return this.transactionsService.findAllForAccount(query.accountId, query.userId);
  }

  @Get('summary')
  getSummary(@Query() query: GetSummaryQueryDto) {
    return this.transactionsService.getSummary(query.accountId, query.userId, query.from, query.to);
  }
}
