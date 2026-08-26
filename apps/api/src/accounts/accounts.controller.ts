import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { GetBalanceQueryDto } from './dto/get-balance-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser() userId: string) {
    return this.accountsService.findAllForUser(userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string) {
    return this.accountsService.findOneForUser(id, userId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(id, userId, dto);
  }

  @Get(':id/balance')
  getBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() userId: string,
    @Query() query: GetBalanceQueryDto,
  ) {
    return this.accountsService.getBalanceAsOf(id, userId, query.asOf);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string) {
    return this.accountsService.remove(id, userId);
  }
}
