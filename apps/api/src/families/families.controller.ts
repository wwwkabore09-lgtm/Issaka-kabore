import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('families')
@UseGuards(JwtAuthGuard)
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Post()
  create(@CurrentUser() userId: string, @Body() dto: CreateFamilyDto) {
    return this.familiesService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser() userId: string) {
    return this.familiesService.findAllForUser(userId);
  }

  @Get(':id/shared-accounts')
  getSharedAccounts(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string) {
    return this.familiesService.getSharedAccounts(id, userId);
  }

  @Post(':id/members')
  addMember(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string, @Body() dto: AddMemberDto) {
    return this.familiesService.addMember(id, userId, dto);
  }

  @Delete(':id/members/:memberUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberUserId', ParseUUIDPipe) memberUserId: string,
    @CurrentUser() userId: string,
  ) {
    await this.familiesService.removeMember(id, memberUserId, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() userId: string) {
    await this.familiesService.remove(id, userId);
  }
}
