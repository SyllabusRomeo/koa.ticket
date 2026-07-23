import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { ROLES } from '@logit/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BrandingService } from './branding.service';

class UpdateThemeDto {
  @IsString()
  @MinLength(2)
  themeId!: string;

  @IsOptional()
  @IsObject()
  colors?: Record<string, string> | null;
}

@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  /** Public — login page reads logo / banner / theme without a session. */
  @Get()
  get() {
    return this.branding.getPublic();
  }

  @Get('assets/:kind')
  async asset(
    @Param('kind') kind: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (kind !== 'logo' && kind !== 'banner') {
      throw new NotFoundException('Unknown branding asset');
    }
    const result = await this.branding.streamAsset(kind);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${result.filename.replace(/"/g, '')}"`,
    );
    return result.file;
  }

  @Patch('theme')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(ROLES.SYSADMIN)
  updateTheme(
    @CurrentUser() user: AuthUserView,
    @Body() dto: UpdateThemeDto,
    @Req() req: { ip?: string },
  ) {
    return this.branding.updateTheme(
      user,
      { themeId: dto.themeId, colors: dto.colors },
      req.ip,
    );
  }

  @Post('logo')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(ROLES.SYSADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
    }),
  )
  uploadLogo(
    @CurrentUser() user: AuthUserView,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { ip?: string },
  ) {
    return this.branding.uploadLogo(user, file, req.ip);
  }

  @Post('banner')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(ROLES.SYSADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  uploadBanner(
    @CurrentUser() user: AuthUserView,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { ip?: string },
  ) {
    return this.branding.uploadBanner(user, file, req.ip);
  }

  @Post('reset')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(ROLES.SYSADMIN)
  @HttpCode(HttpStatus.OK)
  reset(@CurrentUser() user: AuthUserView, @Req() req: { ip?: string }) {
    return this.branding.reset(user, req.ip);
  }
}
