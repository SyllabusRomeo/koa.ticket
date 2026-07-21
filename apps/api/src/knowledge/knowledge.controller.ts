import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { KnowledgeService } from './knowledge.service';

class CreateArticleDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(3)
  body!: string;

  @IsString()
  @MinLength(2)
  slug!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

@Controller('knowledge')
@UseGuards(SessionAuthGuard, RolesGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list(@CurrentUser() user: AuthUserView) {
    if (user.permissions.includes(PERMISSIONS.KNOWLEDGE_WRITE)) {
      return this.knowledge.listAll();
    }
    return this.knowledge.listPublished();
  }

  @Get(':slug')
  get(@CurrentUser() user: AuthUserView, @Param('slug') slug: string) {
    return this.knowledge.getBySlug(
      slug,
      user.permissions.includes(PERMISSIONS.KNOWLEDGE_WRITE),
    );
  }

  @Post()
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_WRITE)
  create(@CurrentUser() user: AuthUserView, @Body() dto: CreateArticleDto) {
    return this.knowledge.create({ ...dto, createdById: user.id });
  }

  @Post(':id/publish')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_WRITE)
  publish(@Param('id') id: string) {
    return this.knowledge.publish(id);
  }
}
