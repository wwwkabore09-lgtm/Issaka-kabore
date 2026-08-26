import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListDebtsQueryDto } from './dto/list-debts-query.dto';
import { OwnerQueryDto } from './dto/owner-query.dto';

@Controller('debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Post()
  create(@Body() dto: CreateDebtDto) {
    return this.debtsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListDebtsQueryDto) {
    return this.debtsService.findAllForUser(query.userId, query.type);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    return this.debtsService.findOneForUser(id, query.userId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto, @Body() dto: UpdateDebtDto) {
    return this.debtsService.update(id, query.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    await this.debtsService.remove(id, query.userId);
  }

  @Get(':id/payments')
  listPayments(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    return this.debtsService.listPayments(id, query.userId);
  }

  @Post(':id/payments')
  addPayment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePaymentDto) {
    return this.debtsService.addPayment(id, dto);
  }
}
