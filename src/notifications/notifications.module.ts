import { Module } from '@nestjs/common';
import { NotificationsService } from './service/notifications.service';
import { NotificationsController } from './controller/notifications.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [],
  controllers: [NotificationsController],
  providers: [NotificationsService, PrismaService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
