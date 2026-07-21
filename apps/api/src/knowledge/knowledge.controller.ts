import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
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

class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  body?: string;

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

  /** Inline image upload for the rich-text editor (knowledge:write). */
  @Post('media')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadMedia(
    @CurrentUser() user: AuthUserView,
    @UploadedFile() file: Express.Multer.File,
    @Query('articleId') articleId?: string,
  ) {
    return this.knowledge.uploadMedia(user, file, articleId);
  }

  @Get('attachments/:id/content')
  async content(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.knowledge.streamAttachment(user, id, 'inline');
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${result.filename.replace(/"/g, '')}"`,
    );
    return result.file;
  }

  @Get('attachments/:id/download')
  async download(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.knowledge.streamAttachment(
      user,
      id,
      'attachment',
    );
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename.replace(/"/g, '')}"`,
    );
    return result.file;
  }

  @Get(':id/attachments')
  listAttachments(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
  ) {
    return this.knowledge.listAttachments(user, id);
  }

  @Post(':id/attachments')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_WRITE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadAttachment(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.knowledge.uploadAttachment(user, id, file);
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

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_WRITE)
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.knowledge.update(id, dto);
  }

  @Post(':id/publish')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_WRITE)
  publish(@Param('id') id: string) {
    return this.knowledge.publish(id);
  }
}
