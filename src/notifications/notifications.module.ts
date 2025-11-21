import { Module } from '@nestjs/common';
import { NotificationsService } from './service/notifications.service';
import { NotificationsController } from './controller/notifications.controller';

@Module({
  imports: [],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class Notifications {}