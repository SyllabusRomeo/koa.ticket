import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AssignmentController,
  SkillsController,
} from './assignment.controller';
import { AssignmentService } from './assignment.service';

@Module({
  imports: [AuthModule],
  controllers: [AssignmentController, SkillsController],
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
