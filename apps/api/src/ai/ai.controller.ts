import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { PERMISSIONS } from '@logit/shared';
import { RequirePermissions } from '../auth/decorators';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AiService } from './ai.service';

class TextAssistDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class SummarizeDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsOptional()
  @IsString()
  ticketNumber?: string;
}

@Controller('ai')
@UseGuards(SessionAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  status() {
    return this.ai.provider();
  }

  @Post('assist/classify')
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  classify(@Body() dto: TextAssistDto) {
    return this.ai.classify({
      title: dto.title,
      description: dto.description ?? '',
    });
  }

  @Post('assist/summarize')
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  summarize(@Body() dto: SummarizeDto) {
    return this.ai.summarize(dto);
  }

  @Post('assist/duplicates')
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  duplicates(@Body() dto: TextAssistDto & { excludeTicketId?: string }) {
    return this.ai.findDuplicates({
      title: dto.title,
      description: dto.description,
      excludeTicketId: dto.excludeTicketId,
    });
  }

  @Post('assist/knowledge')
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_READ)
  knowledge(@Body() dto: TextAssistDto) {
    return this.ai.suggestKnowledge({
      title: dto.title,
      description: dto.description,
    });
  }

  @Get('assist/sla-risk/:ref')
  @RequirePermissions(PERMISSIONS.TICKETS_READ_QUEUE)
  slaRisk(@Param('ref') ref: string) {
    return this.ai.slaRisk(decodeURIComponent(ref));
  }
}
