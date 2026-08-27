import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminPremiumService } from './admin-premium.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

const MAX_TRANSACTIONS_LIMIT = 200;
const DEFAULT_TRANSACTIONS_LIMIT = 50;

@Controller('admin/premium')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminPremiumController {
  constructor(private readonly adminPremiumService: AdminPremiumService) {}

  @Get('stats')
  getStats() {
    return this.adminPremiumService.getStats();
  }

  @Get('transactions')
  listTransactions(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : DEFAULT_TRANSACTIONS_LIMIT;
    const bounded = Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_TRANSACTIONS_LIMIT ? parsed : DEFAULT_TRANSACTIONS_LIMIT;
    return this.adminPremiumService.listTransactions(bounded);
  }
}
