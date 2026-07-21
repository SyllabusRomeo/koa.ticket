import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators';
import type { AuthUserView } from '../auth/auth.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AttachmentsService } from './attachments.service';

@Controller()
@UseGuards(SessionAuthGuard, RolesGuard)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('tickets/:id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { ip?: string },
  ) {
    return this.attachments.upload(user, id, file, req.ip);
  }

  @Get('tickets/:id/attachments')
  list(@CurrentUser() user: AuthUserView, @Param('id') id: string) {
    return this.attachments.list(user, id);
  }

  @Get('attachments/limits')
  limits() {
    return this.attachments.limits();
  }

  @Get('attachments/:id/download')
  async download(
    @CurrentUser() user: AuthUserView,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.attachments.download(user, id);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename.replace(/"/g, '')}"`,
    );
    return result.file;
  }
}
