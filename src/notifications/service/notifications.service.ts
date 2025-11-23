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
  async saveSubscription(clienteId: any, prestadorId: any, subscription: any) {
    console.log('💾 Salvando subscription:', {
      clienteId,
      prestadorId,
      clienteIdIsNull: clienteId === null,
      prestadorIdIsNull: prestadorId === null,
      clienteIdIsUndefined: clienteId === undefined,
      prestadorIdIsUndefined: prestadorId === undefined,
    });

    // Converte undefined para null e faz parse de números
    const safeClienteId = this.safeParseId(clienteId);
    const safePrestadorId = this.safeParseId(prestadorId);

    console.log('🔧 IDs após tratamento:', {
      safeClienteId,
      safePrestadorId,
    });

    // Validação corrigida
    if (!safeClienteId && !safePrestadorId) {
      throw new Error('É necessário fornecer clienteId OU prestadorId');
    }

    // CLIENTE
    if (safeClienteId && !safePrestadorId) {
      console.log('👤 Salvando para cliente:', safeClienteId);

      return this.saveForCliente(safeClienteId, subscription);
    }

    // PRESTADOR
    if (!safeClienteId && safePrestadorId) {
      console.log('👷 Salvando para prestador:', safePrestadorId);

      return this.saveForPrestador(safePrestadorId, subscription);
    }

    // Caso ambos preenchidos (raro) - usa cliente como prioridade
    console.warn('⚠️ Ambos IDs preenchidos, usando cliente como prioridade');
    return this.saveForCliente(safeClienteId, subscription);
  }

  private safeParseId(id: any): number | null {
    if (
      id === null ||
      id === undefined ||
      id === 'null' ||
      id === 'undefined'
    ) {
      return null;
    }

    // Converte para número se for string
    const parsed = Number(id);
    return isNaN(parsed) ? null : parsed;
  }

  private async saveForCliente(clienteId: number, subscription: any) {
    const existing = await this.prisma.userSubscription.findFirst({
      where: {
        clienteId: clienteId,
        prestadorId: null,
      },
    });

    if (existing) {
      return this.prisma.userSubscription.update({
        where: { id: existing.id },
        data: {
          subscriptionJson: JSON.stringify(subscription),
        },
      });
    } else {
      return this.prisma.userSubscription.create({
        data: {
          clienteId: clienteId,
          prestadorId: null,
          subscriptionJson: JSON.stringify(subscription),
        },
      });
    }
  }

  private async saveForPrestador(prestadorId: number, subscription: any) {
    const existing = await this.prisma.userSubscription.findFirst({
      where: {
        prestadorId: prestadorId,
        clienteId: null,
      },
    });

    if (existing) {
      return this.prisma.userSubscription.update({
        where: { id: existing.id },
        data: {
          subscriptionJson: JSON.stringify(subscription),
        },
      });
    } else {
      return this.prisma.userSubscription.create({
        data: {
          clienteId: null,
          prestadorId: prestadorId,
          subscriptionJson: JSON.stringify(subscription),
        },
      });
    }
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

  async sendCardCreatedPush(card: any) {
    this.logger.log(
      `🔔 Enviando push de novo card para card=${card.id_pedido}`,
    );

    // ------------------------------------
    // 1. SALVA A NOTIFICAÇÃO NO BANCO
    // ------------------------------------
    const saved = await this.prisma.notification.create({
      data: {
        title: 'Novo Pedido Disponível!',
        body: `${card.categoria} — ${card.city || ''} ${card.state ? '(' + card.state + ')' : ''}`.trim(),
        icon: '/assets/icons/icon-192x192.png',
        url: `https://use-tudu.com.br/home/budgets?id=${card.id_pedido}&flow=publicado`,
        clienteId: null,
        prestadorId: null,
      },
    });

    // ------------------------------------
    // 2. PREPARA PAYLOAD PARA O PUSH
    //    (INDEPENDENTE DO BANCO)
    // ------------------------------------
    const pushPayload = {
      title: saved.title,
      body: saved.body,
      icon: saved.icon,
      url: saved.url,

      // Estes NÃO vão para o banco, apenas para o push:
      badge: '/assets/icons/badge-72x72.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      channelId: 'high-priority',
      tag: `card-${card.id_pedido}`,
    };

    // ------------------------------------
    // 3. BUSCA TODAS AS SUBSCRIPTIONS
    // ------------------------------------
    const subs = await this.prisma.userSubscription.findMany();

    if (subs.length === 0) {
      this.logger.warn('⚠ Nenhuma subscription encontrada para envio de push');
      return saved;
    }

    // ------------------------------------
    // 4. ENVIA O PUSH PARA CADA SUBSCRITO
    // ------------------------------------
    const results = await Promise.allSettled(
      subs.map(async (s) => {
        try {
          const subscription = JSON.parse(s.subscriptionJson);
          await webpush.sendNotification(
            subscription,
            JSON.stringify(pushPayload),
          );
          return { id: s.id, ok: true };
        } catch (err) {
          return { id: s.id, ok: false, error: err };
        }
      }),
    );

    // Remove subscriptions inválidas (status 410 ou 404)
    const invalidIds: number[] = [];
    results.forEach((r) => {
      if (r.status === 'fulfilled' && !r.value.ok) {
        const err = r.value.error;
        const code = err?.statusCode || err?.status;
        if (code === 404 || code === 410) {
          invalidIds.push(r.value.id);
        }
      }
    });

    if (invalidIds.length > 0) {
      this.logger.warn(
        `🗑 Removendo ${invalidIds.length} subscriptions inválidas`,
      );
      await this.prisma.userSubscription.deleteMany({
        where: { id: { in: invalidIds } },
      });
    }

    this.logger.log('✅ Push de card novo concluído!');
    return saved;
  }

  async enviarPushNovaCandidatura(
    clienteId: number,
    id_pedido: string,
    prestador: any,
    candidatura: any,
    card: any,
  ) {
    try {
      // 📌 Busca todas as subscriptions do dono do card
      const subs = await this.prisma.userSubscription.findMany({
        where: { clienteId },
      });

      if (!subs.length) {
        return; // Nenhum dispositivo inscrito
      }

      // 📌 Cria registro da notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `Nova candidatura recebida`,
          body: `${prestador.nome} ofereceu R$ ${candidatura.valor_negociado}`,
          icon: '/assets/icons/icon-192x192.png',
          url: `/card/${id_pedido}`,
          clienteId,
        },
      });

      // Payload enviado ao navegador
      const payload = JSON.stringify({
        title: '📨 Nova Candidatura',
        body: `${prestador.nome} enviou uma proposta no seu pedido.`,
        icon: '/assets/icons/icon-192x192.png',
        data: {
          url: `https://use-tudu.com.br/home/budgets?id=${card.id_pedido}&flow=publicado`,
        },
      });

      // 📌 Envia o push notification
      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);

        try {
          await webpush.sendNotification(sub, payload);
        } catch (err) {
          console.error('Erro enviando push:', err);
        }
      }
    } catch (err) {
      console.error('Erro enviarPushNovaCandidatura:', err);
    }
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
