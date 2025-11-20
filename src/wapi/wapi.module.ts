import { Module } from '@nestjs/common';
import { WApiController } from './controller/wapi.controller';
import { WApiService } from './service/wapi.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './service/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [WApiController],
  providers: [WApiService, NotificationService, PrismaService],
  exports: [WApiService, NotificationService],
})
export class WApiModule {}
