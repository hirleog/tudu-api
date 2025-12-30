import { Module } from '@nestjs/common';
import { NotificationsService } from './service/notifications.service';
import { NotificationsController } from './controller/notifications.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationCleanupService } from './notification-clean-up.service';

@Module({
  imports: [],
  controllers: [NotificationsController],
  providers: [NotificationsService, PrismaService, NotificationCleanupService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
