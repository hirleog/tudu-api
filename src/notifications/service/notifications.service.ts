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

  async sendCardCreatedPushOptimized(card: any) {
    this.logger.log(`🔔 Enviando HEADS-UP push para PRESTADORES`);

    const prestadorSubscriptions = await this.prisma.userSubscription.findMany({
      where: {
        prestadorId: { not: null },
      },
    });

    // 🔥 PAYLOAD OTIMIZADO PARA HEADS-UP NOTIFICATIONS
    const pushPayload = {
      title: '🎯 NOVO PEDIDO DISPONÍVEL!',
      body: `${card.categoria} - R$ ${card.valor} - ${card.city}, ${card.state}`,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/badge-72x72.png',

      // ✅ CONFIGURAÇÕES HEADS-UP
      requireInteraction: true,
      tag: `new-card-${card.id_pedido}-${Date.now()}`, // Tag única
      renotify: true,
      vibrate: [300, 100, 400, 100, 400],

      // ✅ DADOS ESTRUTURADOS
      data: {
        url: '/tudu-professional/home',
        cardId: card.id_pedido,
        categoria: card.categoria,
        valor: card.valor,
        cidade: card.city,
        isHeadsUp: true,
        timestamp: new Date().toISOString(),
      },

      // ✅ AÇÕES RÁPIDAS
      actions: [
        {
          action: 'open',
          title: '📱 Abrir App',
          icon: '/assets/icons/open-72x72.png',
        },
        {
          action: 'view_card',
          title: '👀 Ver Pedido',
          icon: '/assets/icons/eye-72x72.png',
        },
      ],
    };

    const results = await Promise.allSettled(
      prestadorSubscriptions.map(async (subscription) => {
        try {
          const subData = JSON.parse(subscription.subscriptionJson);
          await webpush.sendNotification(subData, JSON.stringify(pushPayload));

          await this.prisma.notification.create({
            data: {
              title: pushPayload.title,
              body: pushPayload.body,
              icon: pushPayload.icon,
              url: pushPayload.data.url,
              prestadorId: subscription.prestadorId,
              read: false,
              // ✅ Marca como heads-up no banco também
              metadata: JSON.stringify({
                isHeadsUp: true,
                cardId: card.id_pedido,
              }),
            },
          });

          return { ok: true, prestadorId: subscription.prestadorId };
        } catch (err) {
          console.error(
            `Erro ao enviar push para prestador ${subscription.prestadorId}:`,
            err,
          );
          return {
            ok: false,
            prestadorId: subscription.prestadorId,
            error: err,
          };
        }
      }),
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.ok,
    ).length;
    this.logger.log(
      `🎉 HEADS-UP Notifications: ${successCount} enviadas com sucesso!`,
    );
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

      const urlCompleta = `https://use-tudu.com.br/home/budgets?id=${card.id_pedido}&flow=publicado`;

      console.log('🔗 URL gerada:', urlCompleta);

      // 📌 Cria registro da notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `Nova candidatura recebida`,
          body: `${prestador.nome} ofereceu R$ ${candidatura.valor_negociado}`,
          icon: '/assets/icons/icon-192x192.png',
          url: urlCompleta, // ✅ Salva a URL completa
          clienteId,
        },
      });

      // ✅ CORRETO: Payload com URL no nível raiz
      const payload = JSON.stringify({
        title: '📨 Nova Candidatura',
        body: `${prestador.nome} enviou uma proposta no seu pedido.`,
        icon: '/assets/icons/icon-192x192.png',
        url: urlCompleta, // ✅ URL no nível raiz
        data: {
          url: urlCompleta, // ✅ Também mantém em data para compatibilidade
          cardId: card.id_pedido,
          type: 'NEW_CANDIDATURE',
        },
      });

      console.log('📦 Payload completo:', payload);

      // 📌 Envia o push notification
      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);

        try {
          await webpush.sendNotification(sub, payload);
          console.log('✅ Push enviado com URL:', urlCompleta);
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
