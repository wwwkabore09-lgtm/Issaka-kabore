import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Body, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { OwnerQueryDto } from './dto/owner-query.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate')
  generate(@Body() dto: GenerateReportDto) {
    return this.reportsService.generate(dto);
  }

  @Get()
  findAll(@Query() query: OwnerQueryDto) {
    return this.reportsService.findAllForUser(query.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    return this.reportsService.findOneForUser(id, query.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    await this.reportsService.remove(id, query.userId);
  }
}
