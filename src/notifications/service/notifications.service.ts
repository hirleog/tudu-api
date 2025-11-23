import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as webpush from 'web-push';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {
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

  /** ------------------------------------------------------------------
   *  🔔 SALVA NOTIFICAÇÃO NO BANCO
   *  ------------------------------------------------------------------ */
  async create(data: {
    title: string;
    body: string;
    icon: string;
    url: string;
    clienteId?: number;
    prestadorId?: number;
  }) {
    return this.prisma.notification.create({ data });
  }

  /** ------------------------------------------------------------------
   *  📌 LISTA TODAS AS NOTIFICAÇÕES
   *  ------------------------------------------------------------------ */
  async findAll() {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /** ------------------------------------------------------------------
   *  📡 BUSCA TODAS AS SUBSCRIPTIONS REGISTRADAS
   *  ------------------------------------------------------------------ */
  async getAllSubscriptions() {
    const subs = await this.prisma.userSubscription.findMany();

    return subs.map((s) => ({
      clienteId: s.clienteId,
      prestadorId: s.prestadorId,
      subscription: JSON.parse(s.subscriptionJson),
    }));
  }

  /** ------------------------------------------------------------------
   *  📬 SALVA SUBSCRIPTION DO FRONT-END
   *  ------------------------------------------------------------------ */
  async saveSubscription(
    clienteId: number,
    prestadorId: number,
    subscription: any,
  ) {
    return this.prisma.userSubscription.upsert({
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
  }

  /** ------------------------------------------------------------------
   *  📣 ENVIA PUSH PARA UM USUÁRIO ESPECÍFICO
   *  ------------------------------------------------------------------ */
  async sendNotification({
    title,
    body,
    icon,
    url,
    clienteId,
    prestadorId,
  }: {
    title: string;
    body: string;
    icon: string;
    url: string;
    clienteId: number;
    prestadorId: number;
  }) {
    this.logger.log(
      `📨 Criando notificação para cliente=${clienteId} prestador=${prestadorId}`,
    );

    const notification = await this.create({
      title,
      body,
      icon,
      url,
      clienteId,
      prestadorId,
    });

    const user = await this.prisma.userSubscription.findFirst({
      where: { clienteId, prestadorId },
    });

    if (!user || !user.subscriptionJson) {
      this.logger.warn(
        `⚠ Usuário sem subscription. cliente=${clienteId} prestador=${prestadorId}`,
      );
      return notification;
    }

    try {
      await webpush.sendNotification(
        JSON.parse(user.subscriptionJson),
        JSON.stringify({ title, body, icon, url }),
      );

      this.logger.log('✅ Push enviado com sucesso!');
    } catch (err) {
      this.logger.error('❌ Erro ao enviar push', err);
    }

    return notification;
  }

  /** ------------------------------------------------------------------
   *  🧪 USA O MÉTODO SEND PARA TESTE
   *  ------------------------------------------------------------------ */
  async testNotification(clienteId: number, prestadorId: number) {
    return this.sendNotification({
      title: 'Test Push',
      body: 'Funcionou!',
      icon: '/assets/icons/icon-192x192.png',
      url: 'https://google.com',
      clienteId,
      prestadorId,
    });
  }
}
