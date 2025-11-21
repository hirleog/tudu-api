import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import webpush from 'web-push';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {
    // Valida se as chaves estão carregadas
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      this.logger.error(
        '❌ ERRO: Variáveis VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não definidas!',
      );
    }

    webpush.setVapidDetails(
      'mailto:seu-email@dominio.com',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }

  async sendNotification({ title, body, icon, url, clienteId, prestadorId }) {
    this.logger.log(
      `📨 Criando notificação para cliente=${clienteId} prestador=${prestadorId}`,
    );

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

    this.logger.log('📌 Notificação salva no banco com ID ' + notification.id);

    // 2 — Busca subscription do usuário
    const user = await this.prisma.userSubscription.findFirst({
      where: { clienteId, prestadorId },
    });

    if (!user || !user.subscriptionJson) {
      this.logger.warn(
        `⚠ Usuário sem subscription. cliente=${clienteId} prestador=${prestadorId}`,
      );
      return notification;
    }

    this.logger.log('🔔 Enviando push para usuário...');

    // 3 — Envia via Web Push
    try {
      await webpush.sendNotification(
        JSON.parse(user.subscriptionJson),
        JSON.stringify({
          title,
          body,
          icon,
          url,
        }),
      );

      this.logger.log('✅ Push enviado com sucesso!');
    } catch (error) {
      this.logger.error('❌ Erro ao enviar push', error);
    }

    return notification;
  }

  async saveSubscription(
    clienteId: number,
    prestadorId: number,
    subscription: any,
  ) {
    const saved = await this.prisma.userSubscription.upsert({
      where: {
        clienteId_prestadorId: {
          clienteId,
          prestadorId,
        },
      },
      update: {
        subscriptionJson: JSON.stringify(subscription),
      },
      create: {
        clienteId,
        prestadorId,
        subscriptionJson: JSON.stringify(subscription),
      },
    });

    return saved; // ← AQUI É O RETORNO QUE VOCÊ CONSEGUE TESTAR!
  }
}
