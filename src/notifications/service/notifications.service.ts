import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import webpush from 'web-push';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {
    webpush.setVapidDetails(
      'mailto:seu-email@dominio.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  }

  async sendNotification({ title, body, icon, url, clienteId, prestadorId }) {
    // 1 — Salva no banco
    const notification = await this.prisma.notification.create({
      data: {
        title,
        body,
        icon,
        url,
        clienteId,
        prestadorId,
      },
    });

    // 2 — Busca subscription do usuário
    const user = await this.prisma.userSubscription.findFirst({
      where: { clienteId, prestadorId },
    });

    if (!user || !user.subscriptionJson) {
      console.log('Usuário sem subscription');
      return notification;
    }

    // 3 — Envia via Web Push
    await webpush.sendNotification(
      JSON.parse(user.subscriptionJson),
      JSON.stringify({
        title,
        body,
        icon,
        url,
      }),
    );

    return notification;
  }
}
