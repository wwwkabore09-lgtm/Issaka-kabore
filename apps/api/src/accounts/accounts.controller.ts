import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { GetBalanceQueryDto } from './dto/get-balance-query.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListAccountsQueryDto) {
    return this.accountsService.findAllForUser(query.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query() query: ListAccountsQueryDto) {
    return this.accountsService.findOneForUser(id, query.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListAccountsQueryDto,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(id, query.userId, dto);
  }

  @Get(':id/balance')
  getBalance(@Param('id', ParseUUIDPipe) id: string, @Query() query: GetBalanceQueryDto) {
    return this.accountsService.getBalanceAsOf(id, query.userId, query.asOf);
  }
}
