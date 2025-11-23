import { Controller, Post, Get, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import * as webpush from 'web-push';
import { NotificationsService } from '../service/notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService, // ← AQUI
  ) {
    webpush.setVapidDetails(
      'mailto:seu-email@dominio.com',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }

  @Post('subscribe')
  async subscribe(@Body() body: any) {
    const { clienteId, prestadorId, subscription } = body;

    return this.notificationsService.saveSubscription(
      clienteId ?? null,
      prestadorId ?? null,
      subscription,
    );
  }

  @Post('test')
  async sendTest(@Res() res: Response) {
    const payload = {
      title: 'Test Push',
      body: 'Funcionou!',
      icon: '/assets/icons/icon-192x192.png',
      url: 'https://google.com',
    };

    // 1. Salva a notificação no banco
    const saved = await this.notificationsService.create(payload);

    // 2. Busca todas as inscrições de push
    const subscriptions = await this.notificationsService.getAllSubscriptions();

    // 3. Envia push para cada inscrito
    subscriptions.forEach((sub) => {
      webpush
        .sendNotification(sub.subscription, JSON.stringify(payload))
        .catch((err) =>
          console.error('Erro ao enviar push para assinatura: ', err),
        );
    });

    return res.json(saved);
  }

  @Get()
  async all() {
    return this.notificationsService.findAll();
  }
}
