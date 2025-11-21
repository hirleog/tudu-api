import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { NotificationsService } from '../service/notifications.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async send(@Body() data) {
    return this.service.sendNotification(data);
  }
  @Patch(':id/read')
  async markRead(@Param('id') id: number) {
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  @Post('subscribe')
  async subscribe(@Body() body) {
    return this.service.saveSubscription(
      body.clienteId,
      body.prestadorId,
      body.subscription,
    );
  }
}
