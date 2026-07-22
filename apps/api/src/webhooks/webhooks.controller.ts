import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WebhooksService } from './webhooks.service';

class CreateWebhookDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @IsString({ each: true })
  eventTypes!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  rotateSecret?: boolean;
}

@Controller('webhooks')
@UseGuards(SessionAuthGuard, RolesGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get('events')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  events() {
    return {
      enabled: this.webhooks.isEnabled(),
      events: this.webhooks.eventCatalog(),
    };
  }

  @Get('endpoints')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  list() {
    return this.webhooks.listEndpoints();
  }

  @Post('endpoints')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooks.createEndpoint(dto);
  }

  @Patch('endpoints/:id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooks.updateEndpoint(id, dto);
  }

  @Delete('endpoints/:id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  remove(@Param('id') id: string) {
    return this.webhooks.deleteEndpoint(id);
  }

  @Post('endpoints/:id/test')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  test(@Param('id') id: string) {
    return this.webhooks.testPing(id);
  }

  @Get('endpoints/:id/deliveries')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  deliveries(@Param('id') id: string) {
    return this.webhooks.listRecentDeliveries(id);
  }
}
