import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssetsController } from './assets.controller';

@Module({
  imports: [AuthModule],
  controllers: [AssetsController],
})
export class AssetsModule {}
