import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { OwnerQueryDto } from './dto/owner-query.dto';
import { RequestingUserQueryDto } from './dto/requesting-user-query.dto';

@Controller('families')
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Post()
  create(@Body() dto: CreateFamilyDto) {
    return this.familiesService.create(dto);
  }

  @Get()
  findAll(@Query() query: OwnerQueryDto) {
    return this.familiesService.findAllForUser(query.userId);
  }

  @Get(':id/shared-accounts')
  getSharedAccounts(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    return this.familiesService.getSharedAccounts(id, query.userId);
  }

  @Post(':id/members')
  addMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddMemberDto) {
    return this.familiesService.addMember(id, dto);
  }

  @Delete(':id/members/:memberUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberUserId', ParseUUIDPipe) memberUserId: string,
    @Query() query: RequestingUserQueryDto,
  ) {
    await this.familiesService.removeMember(id, memberUserId, query.requestingUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Query() query: OwnerQueryDto) {
    await this.familiesService.remove(id, query.userId);
  }
}
