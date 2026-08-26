import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { OwnerQueryDto } from './dto/owner-query.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptionsService.findAllForUser(query.userId, query.activeOnly);
  }

  @Get('summary')
  getSummary(@Query() query: OwnerQueryDto) {
    return this.subscriptionsService.getSummary(query.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    return this.subscriptionsService.findOneForUser(id, query.userId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionsService.update(id, query.userId, dto);
  }

  @Post(':id/renew')
  renew(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RenewSubscriptionDto) {
    return this.subscriptionsService.renew(id, dto.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    await this.subscriptionsService.remove(id, query.userId);
  }
}
