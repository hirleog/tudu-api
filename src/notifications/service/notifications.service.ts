import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as webpush from 'web-push';

interface FindAllOptions {
  page: number;
  limit: number;
  clienteId?: number;
  prestadorId?: number;
  read?: boolean;
}

interface CreateNotificationData {
  title: string;
  body: string;
  icon: string;
  id_pedido: string;
  clienteId?: number;
  prestadorId?: number;
  status?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private processingCards = new Set<string>(); // Para evitar processamento concorrente

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
   *  🔔 SALVA NOTIFICAÇÃO NO BANCO (COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async create(data: CreateNotificationData) {
    // Verifica se já existe notificação similar recentemente (para evitar duplicação)
    const existingNotification = await this.prisma.notification.findFirst({
      where: {
        id_pedido: data.id_pedido,
        status: data.status || 'GENERAL',
        OR: [
          { clienteId: data.clienteId || undefined },
          { prestadorId: data.prestadorId || undefined },
        ],
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Últimos 5 minutos
        },
      },
    });

    if (existingNotification) {
      this.logger.log(
        `ℹ Notificação similar já existe (ID: ${existingNotification.id}), retornando existente`,
      );
      return existingNotification;
    }

    return this.prisma.notification.create({
      data: {
        title: data.title,
        body: data.body,
        icon: data.icon,
        id_pedido: data.id_pedido,
        clienteId: data.clienteId ?? null,
        prestadorId: data.prestadorId ?? null,
        status: data.status || 'GENERAL',
      },
    });
  }

  /** ------------------------------------------------------------------
   *  📌 LISTA TODAS AS NOTIFICAÇÕES COM IMAGENS DO CARD
   *  ------------------------------------------------------------------ */
  async findAll(options: FindAllOptions) {
    const { page, limit, clienteId, prestadorId, read } = options;
    const skip = (page - 1) * limit;

    // Construir where condition
    const where: any = {};

    if (clienteId !== undefined) {
      where.clienteId = clienteId;
    }

    if (prestadorId !== undefined) {
      where.prestadorId = prestadorId;
    }

    if (read !== undefined) {
      where.read = read;
    }

    // Buscar notificações
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          Cliente: {
            select: {
              nome: true,
            },
          },
          Prestador: {
            select: {
              nome: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    // ✅ BUSCAR IMAGENS PARA NOTIFICAÇÕES QUE TEM id_pedido
    const notificationsWithImages = await Promise.all(
      notifications.map(async (notification) => {
        let imagens: string[] = [];

        if (notification.id_pedido) {
          try {
            const cardWithImages = await this.prisma.card.findUnique({
              where: { id_pedido: notification.id_pedido },
              include: {
                imagens: {
                  select: { url: true },
                  orderBy: { createdAt: 'asc' },
                },
              },
            });

            if (cardWithImages && cardWithImages.imagens.length > 0) {
              imagens = cardWithImages.imagens.map((img) => img.url);
            }
          } catch (error) {
            console.log(
              `❌ Erro ao buscar imagens para card ${notification.id_pedido}:`,
              error,
            );
          }
        }

        return {
          ...notification,
          imagens, // ✅ ADICIONA AS IMAGENS À NOTIFICAÇÃO
        };
      }),
    );

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return {
      notifications: notificationsWithImages,
      total,
      page,
      limit,
      totalPages,
      hasMore,
    };
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
    const safeClienteId = this.safeParseId(clienteId);
    const safePrestadorId = this.safeParseId(prestadorId);

    if (!safeClienteId && !safePrestadorId) {
      throw new Error('É necessário fornecer clienteId OU prestadorId');
    }

    const endpoint = subscription?.endpoint;
    if (!endpoint) {
      throw new Error('Subscription inválida: faltando endpoint');
    }

    // Verifica se já existe UMA subscription para o mesmo endpoint
    const existing = await this.prisma.userSubscription.findFirst({
      where: { subscriptionJson: { contains: endpoint } },
    });

    if (existing) {
      return this.prisma.userSubscription.create({
        data: {
          clienteId: safeClienteId,
          prestadorId: safePrestadorId,
          subscriptionJson: JSON.stringify(subscription),
        },
      });
    }
    // Sempre cria uma nova subscription para um novo dispositivo
    return this.prisma.userSubscription.create({
      data: {
        clienteId: safeClienteId,
        prestadorId: safePrestadorId,
        subscriptionJson: JSON.stringify(subscription),
      },
    });
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

  /** ------------------------------------------------------------------
   *  🔔 ENVIA PUSH PARA UM USUÁRIO ESPECÍFICO (COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async sendNotification({
    title,
    body,
    icon,
    id_pedido,
    clienteId,
    prestadorId,
    status = 'GENERAL',
  }: {
    title: string;
    body: string;
    icon: string;
    id_pedido: string;
    clienteId: number;
    prestadorId: number;
    status?: string;
  }) {
    this.logger.log(
      `📨 Criando notificação para cliente=${clienteId} prestador=${prestadorId}`,
    );

    // ✅ 1. Verifica se já existe notificação similar recentemente
    const existingNotification = await this.prisma.notification.findFirst({
      where: {
        id_pedido,
        status,
        OR: [
          { clienteId: clienteId || undefined },
          { prestadorId: prestadorId || undefined },
        ],
        createdAt: {
          gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
        },
      },
    });

    let notification;

    if (existingNotification) {
      this.logger.log(
        `ℹ Notificação similar já existe (ID: ${existingNotification.id})`,
      );
      notification = existingNotification;
    } else {
      // ✅ 2. Cria nova notificação no banco
      notification = await this.prisma.notification.create({
        data: {
          title,
          body,
          icon,
          id_pedido,
          clienteId: clienteId ?? null,
          prestadorId: prestadorId ?? null,
          status,
        },
      });
    }

    // ✅ 3. Busca subscriptions para enviar push (se existirem)
    const userSubscriptions = await this.prisma.userSubscription.findMany({
      where: {
        OR: [
          { clienteId, prestadorId: null },
          { clienteId: null, prestadorId },
          { clienteId, prestadorId },
        ],
      },
    });

    if (!userSubscriptions || userSubscriptions.length === 0) {
      this.logger.warn(
        `⚠ Usuário sem subscription. cliente=${clienteId} prestador=${prestadorId}. Notificação salva no banco para a central.`,
      );
      return notification;
    }

    // ✅ 4. BUSCA IMAGENS DO CARD PARA INCLUIR NO PUSH
    let imagens: string[] = [];
    if (id_pedido) {
      const cardWithImages = await this.prisma.card.findUnique({
        where: { id_pedido },
        include: {
          imagens: {
            select: { url: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (cardWithImages && cardWithImages.imagens.length > 0) {
        imagens = cardWithImages.imagens.map((img) => img.url);
      }
    }

    // ✅ 5. Prepara payload do push
    const pushPayload = {
      title,
      body,
      icon,
      url: this.buildNotificationUrl(id_pedido),
      data: {
        id_pedido,
        type: 'GENERAL_NOTIFICATION',
        imagens, // ✅ INCLUI IMAGENS NO PUSH
        status,
      },
    };

    // ✅ 6. Envia push para todas as subscriptions do usuário
    const pushResults = await Promise.allSettled(
      userSubscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            JSON.parse(subscription.subscriptionJson),
            JSON.stringify(pushPayload),
          );
          return { success: true, subscriptionId: subscription.id };
        } catch (err) {
          this.logger.error(
            `❌ Erro ao enviar push para subscription ${subscription.id}`,
            err,
          );
          return {
            success: false,
            subscriptionId: subscription.id,
            error: err,
          };
        }
      }),
    );

    const successfulPushes = pushResults.filter(
      (result) => result.status === 'fulfilled' && result.value.success,
    ).length;

    this.logger.log(
      `✅ Push enviado: ${successfulPushes}/${userSubscriptions.length} com sucesso!`,
    );

    return notification;
  }

  /** ------------------------------------------------------------------
   *  🔔 ENVIA PUSH PARA TODOS OS PRESTADORES (OTIMIZADO E COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async sendCardCreatedPushOptimized(card: any) {
    const cardId = card.id_pedido;

    // ✅ 1. VERIFICAÇÃO DE CONCORRÊNCIA - Evita múltiplas execuções simultâneas
    if (this.processingCards.has(cardId)) {
      this.logger.warn(
        `⏭️ Card ${cardId} já está sendo processado, ignorando chamada duplicada`,
      );
      return {
        success: false,
        message: 'Card já está sendo processado',
        cardId,
      };
    }

    try {
      this.processingCards.add(cardId);

      this.logger.log(
        `🔔 [LOCKED] Enviando HEADS-UP push para PRESTADORES - Card: ${cardId}`,
      );

      // ✅ 2. VERIFICAÇÃO INICIAL: Já processamos este card recentemente?
      const existingCardNotification = await this.prisma.notification.findFirst(
        {
          where: {
            id_pedido: cardId,
            status: 'NEW_CARD',
            prestadorId: null, // Notificação global do card
            createdAt: {
              gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
            },
          },
        },
      );

      if (existingCardNotification) {
        this.logger.warn(
          `⏭️ Card ${cardId} já foi notificado recentemente (ID: ${existingCardNotification.id})`,
        );
        return {
          success: false,
          message: 'Card já notificado recentemente',
          existingNotificationId: existingCardNotification.id,
          cardId,
        };
      }

      // ✅ 3. Cria uma notificação global para o card (apenas uma)
      const cardGlobalNotification = await this.prisma.notification.create({
        data: {
          title: '🎯 NOVO PEDIDO DISPONÍVEL!',
          body: `${card.categoria} - R$ ${card.valor} - ${card.city}, ${card.state}`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: cardId,
          status: 'NEW_CARD',
          metadata: JSON.stringify({
            isHeadsUp: true,
            cardId,
            categoria: card.categoria,
            valor: card.valor,
            cidade: card.city,
            isGlobalNotification: true,
          }),
        },
      });

      // ✅ 4. Busca prestadores DISTINTOS usando groupBy
      const prestadoresGrupos = await this.prisma.userSubscription.groupBy({
        by: ['prestadorId'],
        where: {
          prestadorId: { not: null },
        },
        _count: {
          _all: true,
        },
      });

      const prestadoresIds = prestadoresGrupos
        .map((g) => g.prestadorId)
        .filter((id): id is number => id !== null);

      if (prestadoresIds.length === 0) {
        this.logger.warn('⚠ Nenhum prestador com subscription encontrado.');
        return {
          success: false,
          message: 'Nenhum prestador com subscription encontrado',
          cardId,
          globalNotificationId: cardGlobalNotification.id,
        };
      }

      // ✅ 5. BUSCA IMAGENS DO CARD (uma vez)
      let imagens: string[] = [];
      if (cardId) {
        const cardWithImages = await this.prisma.card.findUnique({
          where: { id_pedido: cardId },
          include: {
            imagens: {
              select: { url: true },
              orderBy: { createdAt: 'asc' },
              take: 3, // Limita a 3 imagens
            },
          },
        });

        if (cardWithImages?.imagens?.length > 0) {
          imagens = cardWithImages.imagens.map((img) => img.url);
        }
      }

      // ✅ 6. PAYLOAD DO PUSH (constante para todos)
      const pushPayload = {
        title: '🎯 NOVO PEDIDO DISPONÍVEL!',
        body: `${card.categoria} - R$ ${card.valor} - ${card.city}, ${card.state}`,
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge-72x72.png',
        requireInteraction: true,
        tag: `new-card-${cardId}-${Date.now()}`, // Tag única
        renotify: true,
        vibrate: [300, 100, 400, 100, 400],
        data: {
          id_pedido: cardId,
          url: '/tudu-professional/home',
          categoria: card.categoria,
          valor: card.valor,
          cidade: card.city,
          imagens,
          isHeadsUp: true,
          timestamp: new Date().toISOString(),
          status: 'NEW_CARD',
        },
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

      const resultados = [];
      let totalPushEnviados = 0;

      // ✅ 7. PROCESSAMENTO POR PRESTADOR (APENAS ENVIO DE PUSH, SEM CRIAR NOTIFICAÇÕES)
      for (const prestadorId of prestadoresIds) {
        // Busca todas as subscriptions deste prestador
        const subscriptions = await this.prisma.userSubscription.findMany({
          where: { prestadorId },
        });

        if (subscriptions.length === 0) continue;

        // Envia push para todos os dispositivos do prestador
        let pushEnviados = 0;
        for (const subscription of subscriptions) {
          try {
            const subData = JSON.parse(subscription.subscriptionJson);
            await webpush.sendNotification(
              subData,
              JSON.stringify(pushPayload),
            );
            pushEnviados++;
            totalPushEnviados++;
          } catch (err) {
            this.logger.error(`❌ Erro push prestador ${prestadorId}:`, err);
          }
        }

        resultados.push({
          prestadorId,
          pushEnviados,
          totalDispositivos: subscriptions.length,
        });

        // Pequena pausa para evitar sobrecarga
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // ✅ 8. LOG FINAL
      this.logger.log(
        `🎉 FINALIZADO: 1 notificação global criada (ID: ${cardGlobalNotification.id}), ` +
          `${totalPushEnviados} pushes enviados para ${prestadoresIds.length} prestadores`,
      );

      return {
        success: true,
        totalPrestadores: prestadoresIds.length,
        globalNotificationId: cardGlobalNotification.id,
        totalPushEnviados,
        cardId,
        resultados,
      };
    } finally {
      // ✅ 9. LIBERA O LOCK (IMPORTANTE!)
      this.processingCards.delete(cardId);
      this.logger.log(
        `🔓 [UNLOCKED] Processamento do card ${cardId} finalizado`,
      );
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 ENVIA PUSH PARA NOVA CANDIDATURA (COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async enviarPushNovaCandidatura(
    clienteId: number,
    id_pedido: string,
    prestador: any,
    candidatura: any,
    card: any,
    isAtualizacao: boolean = false,
  ) {
    try {
      const status = isAtualizacao ? 'CANDIDATURE_UPDATED' : 'NEW_CANDIDATURE';

      // ✅ 1. Verifica se já existe notificação recente
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          clienteId,
          id_pedido,
          status,
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
          },
        },
      });

      let notification;

      if (existingNotification) {
        this.logger.log(
          `ℹ Notificação já existe para cliente ${clienteId} e card ${id_pedido}`,
        );
        notification = existingNotification;
      } else {
        // ✅ 2. BUSCA IMAGENS DO CARD
        let imagens: string[] = [];
        if (id_pedido) {
          const cardWithImages = await this.prisma.card.findUnique({
            where: { id_pedido },
            include: {
              imagens: {
                select: { url: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          });

          if (cardWithImages && cardWithImages.imagens.length > 0) {
            imagens = cardWithImages.imagens.map((img) => img.url);
          }
        }

        // ✅ 3. Prepara dados da notificação
        const title = isAtualizacao
          ? '📝 Proposta atualizada'
          : '📨 Nova candidatura';

        const body = isAtualizacao
          ? `${prestador.nome} mandou nova proposta de R$ ${candidatura.valor_negociado}`
          : `${prestador.nome} ofereceu R$ ${candidatura.valor_negociado}`;

        // ✅ 4. Cria APENAS UMA notificação no banco
        notification = await this.prisma.notification.create({
          data: {
            title,
            body,
            icon: '/assets/icons/icon-192x192.png',
            id_pedido,
            clienteId,
            status,
            metadata: JSON.stringify({
              imagens,
              isAtualizacao,
              prestadorNome: prestador.nome,
              valorProposta: candidatura.valor_negociado,
            }),
          },
        });
      }

      // ✅ 5. Busca subscriptions do cliente para envio de push
      const subs = await this.prisma.userSubscription.findMany({
        where: { clienteId },
      });

      // ✅ 6. Se não há subscriptions, retorna (notificação já está salva)
      if (!subs.length) {
        this.logger.log(
          `ℹ Notificação salva no banco. Cliente ${clienteId} sem subscription para push.`,
        );
        return notification;
      }

      // ✅ 7. Prepara payload do push
      const pushBody = isAtualizacao
        ? `${prestador.nome} te fez uma nova proposta.`
        : `${prestador.nome} enviou uma proposta no seu pedido.`;

      const payload = JSON.stringify({
        title: isAtualizacao ? '📝 Proposta atualizada' : '📨 Nova candidatura',
        body: pushBody,
        icon: '/assets/icons/icon-192x192.png',
        url: this.buildNotificationUrl(id_pedido),
        data: {
          id_pedido,
          type: isAtualizacao ? 'CANDIDATURA_ATUALIZADA' : 'NEW_CANDIDATURE',
          isAtualizacao,
          status,
        },
      });

      // ✅ 8. Envia push para todas as subscriptions
      let pushEnviados = 0;
      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          pushEnviados++;
        } catch (err) {
          this.logger.error('❌ Erro enviando push:', err);
        }
      }

      this.logger.log(
        `✅ ${pushEnviados} pushes enviados para cliente ${clienteId}`,
      );
      return notification;
    } catch (err) {
      this.logger.error('❌ Erro enviarPushNovaCandidatura:', err);
      throw err;
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA CLIENTE SOBRE CONTRATAÇÃO (COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async notificarClienteContratacao(
    clienteId: number,
    id_pedido: string,
    prestador: any,
    card: any,
  ) {
    try {
      // ✅ 1. Verifica se já existe notificação recente
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          clienteId,
          id_pedido,
          status: 'HIRE_CONFIRMED',
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
          },
        },
      });

      let notification;

      if (existingNotification) {
        this.logger.log(
          `ℹ Notificação de contratação já existe para cliente ${clienteId}`,
        );
        notification = existingNotification;
      } else {
        // ✅ 2. BUSCA IMAGENS DO CARD
        let imagens: string[] = [];
        if (id_pedido) {
          const cardWithImages = await this.prisma.card.findUnique({
            where: { id_pedido },
            include: {
              imagens: {
                select: { url: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          });

          if (cardWithImages && cardWithImages.imagens.length > 0) {
            imagens = cardWithImages.imagens.map((img) => img.url);
          }
        }

        // ✅ 3. Cria APENAS UMA notificação no banco
        notification = await this.prisma.notification.create({
          data: {
            title: `🎉 Contratação confirmada!`,
            body: `${prestador.nome} foi contratado para o seu serviço.`,
            icon: '/assets/icons/icon-192x192.png',
            id_pedido,
            clienteId,
            status: 'HIRE_CONFIRMED',
            metadata: JSON.stringify({
              imagens,
              prestadorNome: prestador.nome,
              categoria: card.categoria,
            }),
          },
        });
      }

      // ✅ 4. Busca subscriptions do cliente
      const subs = await this.prisma.userSubscription.findMany({
        where: { clienteId },
      });

      // ✅ 5. Se não há subscriptions, retorna
      if (!subs.length) {
        this.logger.log(
          `ℹ Notificação de contratação salva no banco. Cliente ${clienteId} sem subscription para push.`,
        );
        return notification;
      }

      // ✅ 6. Prepara e envia push
      const payload = JSON.stringify({
        title: '🎉 Contratação confirmada!',
        body: `Seu pedido está em andamento com ${prestador.nome}.`,
        icon: '/assets/icons/icon-192x192.png',
        url: this.buildNotificationUrl(id_pedido),
        data: {
          id_pedido,
          type: 'CONTRATACAO_CONFIRMADA',
          status: 'HIRE_CONFIRMED',
        },
      });

      let pushEnviados = 0;
      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          pushEnviados++;
        } catch (err) {
          this.logger.error(
            '❌ Erro enviando notificação de contratação:',
            err,
          );
        }
      }

      this.logger.log(
        `✅ ${pushEnviados} pushes de contratação enviados para cliente ${clienteId}`,
      );
      return notification;
    } catch (err) {
      this.logger.error('❌ Erro notificarClienteContratacao:', err);
      throw err;
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA PRESTADOR SOBRE CONTRATAÇÃO (COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async notificarPrestadorContratacao(
    prestadorId: number,
    id_pedido: string,
    card: any,
  ) {
    try {
      // ✅ 1. Verifica se já existe notificação recente
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          prestadorId,
          id_pedido,
          status: 'PROVIDER_HIRED',
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
          },
        },
      });

      let notification;

      if (existingNotification) {
        this.logger.log(
          `ℹ Notificação de contratação já existe para prestador ${prestadorId}`,
        );
        notification = existingNotification;
      } else {
        // ✅ 2. BUSCA IMAGENS DO CARD
        let imagens: string[] = [];
        if (id_pedido) {
          const cardWithImages = await this.prisma.card.findUnique({
            where: { id_pedido },
            include: {
              imagens: {
                select: { url: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          });

          if (cardWithImages && cardWithImages.imagens.length > 0) {
            imagens = cardWithImages.imagens.map((img) => img.url);
          }
        }

        // ✅ 3. Cria APENAS UMA notificação no banco
        notification = await this.prisma.notification.create({
          data: {
            title: `🚀 Você foi contratado!`,
            body: `Parabéns! Você foi selecionado para o serviço de ${card.categoria}.`,
            icon: '/assets/icons/icon-192x192.png',
            id_pedido,
            prestadorId,
            status: 'PROVIDER_HIRED',
            metadata: JSON.stringify({
              imagens,
              categoria: card.categoria,
            }),
          },
        });
      }

      // ✅ 4. Busca subscriptions do prestador
      const subs = await this.prisma.userSubscription.findMany({
        where: { prestadorId },
      });

      // ✅ 5. Se não há subscriptions, retorna
      if (!subs.length) {
        this.logger.log(
          `ℹ Notificação de contratação salva no banco. Prestador ${prestadorId} sem subscription para push.`,
        );
        return notification;
      }

      // ✅ 6. Prepara e envia push
      const payload = JSON.stringify({
        title: '🚀 Você foi contratado!',
        body: `Seu serviço de ${card.categoria} está aguardando confirmação.`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/tudu-professional/home',
        data: {
          id_pedido,
          type: 'PRESTADOR_CONTRATADO',
          status: 'PROVIDER_HIRED',
        },
      });

      let pushEnviados = 0;
      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          pushEnviados++;
        } catch (err) {
          this.logger.error(
            '❌ Erro enviando notificação para prestador:',
            err,
          );
        }
      }

      this.logger.log(
        `✅ ${pushEnviados} pushes de contratação enviados para prestador ${prestadorId}`,
      );
      return notification;
    } catch (err) {
      this.logger.error('❌ Erro notificarPrestadorContratacao:', err);
      throw err;
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA CLIENTE E PRESTADOR SOBRE SERVIÇO FINALIZADO (COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async notificarServicoFinalizado(id_pedido: string, card: any) {
    try {
      // Busca dados do card com relacionamentos
      const cardCompleto = await this.prisma.card.findUnique({
        where: { id_pedido },
        include: {
          Cliente: true,
          Prestador: true,
        },
      });

      if (!cardCompleto) {
        this.logger.error(`❌ Card ${id_pedido} não encontrado`);
        return;
      }

      // ✅ BUSCA IMAGENS DO CARD
      let imagens: string[] = [];
      const cardWithImages = await this.prisma.card.findUnique({
        where: { id_pedido },
        include: {
          imagens: {
            select: { url: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (cardWithImages && cardWithImages.imagens.length > 0) {
        imagens = cardWithImages.imagens.map((img) => img.url);
      }

      // 🔔 NOTIFICA O CLIENTE
      if (cardCompleto.id_cliente) {
        // Verifica se já existe notificação recente
        const existingNotification = await this.prisma.notification.findFirst({
          where: {
            clienteId: cardCompleto.id_cliente,
            id_pedido,
            status: 'SERVICE_COMPLETED',
            createdAt: {
              gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
            },
          },
        });

        if (!existingNotification) {
          // Cria APENAS UMA notificação no banco para o cliente
          await this.prisma.notification.create({
            data: {
              title: `✅ Serviço concluído!`,
              body: `Seu serviço de ${card.categoria} foi finalizado com sucesso.`,
              icon: '/assets/icons/icon-192x192.png',
              id_pedido,
              clienteId: cardCompleto.id_cliente,
              status: 'SERVICE_COMPLETED',
              metadata: JSON.stringify({
                imagens,
                categoria: card.categoria,
              }),
            },
          });
        }

        // Envia push se houver subscriptions
        const subsCliente = await this.prisma.userSubscription.findMany({
          where: { clienteId: cardCompleto.id_cliente },
        });

        if (subsCliente.length > 0) {
          const payloadCliente = JSON.stringify({
            title: '✅ Serviço concluído!',
            body: `Seu serviço de ${card.categoria} foi finalizado com sucesso.`,
            icon: '/assets/icons/icon-192x192.png',
            url: this.buildNotificationUrl(id_pedido),
            data: {
              id_pedido,
              type: 'SERVICO_FINALIZADO',
              status: 'SERVICE_COMPLETED',
            },
          });

          for (const s of subsCliente) {
            const sub = JSON.parse(s.subscriptionJson);
            try {
              await webpush.sendNotification(sub, payloadCliente);
            } catch (err) {
              this.logger.error(
                '❌ Erro enviando notificação para cliente:',
                err,
              );
            }
          }
        }
      }

      // 🔔 NOTIFICA O PRESTADOR
      if (cardCompleto.id_prestador) {
        // Verifica se já existe notificação recente
        const existingNotification = await this.prisma.notification.findFirst({
          where: {
            prestadorId: cardCompleto.id_prestador,
            id_pedido,
            status: 'SERVICE_COMPLETED',
            createdAt: {
              gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
            },
          },
        });

        if (!existingNotification) {
          // Cria APENAS UMA notificação no banco para o prestador
          await this.prisma.notification.create({
            data: {
              title: `🎊 Serviço finalizado!`,
              body: `Parabéns! Você concluiu o serviço de ${card.categoria} com sucesso.`,
              icon: '/assets/icons/icon-192x192.png',
              id_pedido,
              prestadorId: cardCompleto.id_prestador,
              status: 'SERVICE_COMPLETED',
              metadata: JSON.stringify({
                imagens,
                categoria: card.categoria,
              }),
            },
          });
        }

        // Envia push se houver subscriptions
        const subsPrestador = await this.prisma.userSubscription.findMany({
          where: { prestadorId: cardCompleto.id_prestador },
        });

        if (subsPrestador.length > 0) {
          const payloadPrestador = JSON.stringify({
            title: '🎊 Serviço finalizado!',
            body: `Parabéns! Você concluiu o serviço de ${card.categoria} com sucesso.`,
            icon: '/assets/icons/icon-192x192.png',
            url: '/tudu-professional/home',
            data: {
              id_pedido,
              type: 'SERVICO_FINALIZADO',
              status: 'SERVICE_COMPLETED',
            },
          });

          for (const s of subsPrestador) {
            const sub = JSON.parse(s.subscriptionJson);
            try {
              await webpush.sendNotification(sub, payloadPrestador);
            } catch (err) {
              this.logger.error(
                '❌ Erro enviando notificação para prestador:',
                err,
              );
            }
          }
        }
      }

      this.logger.log(
        `✅ Notificações de serviço finalizado processadas para card ${id_pedido}`,
      );
    } catch (err) {
      this.logger.error('❌ Erro notificarServicoFinalizado:', err);
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA CANDIDATURA RECUSADA (COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async notificarCandidaturaRecusada(
    prestadorId: number,
    id_pedido: string,
    card: any,
  ) {
    try {
      // ✅ 1. Verifica se já existe notificação recente
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          prestadorId,
          id_pedido,
          status: 'CANDIDATURE_REJECTED',
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
          },
        },
      });

      if (existingNotification) {
        this.logger.log(
          `ℹ Notificação de recusa já existe para prestador ${prestadorId}`,
        );
        return existingNotification;
      }

      // ✅ 2. Cria APENAS UMA notificação no banco
      const notification = await this.prisma.notification.create({
        data: {
          title: `📝 Proposta não selecionada`,
          body: `Sua proposta para ${card.categoria} não foi selecionada. Faça uma nova proposta!`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido,
          prestadorId,
          status: 'CANDIDATURE_REJECTED',
        },
      });

      // ✅ 3. Busca subscriptions para push (se existirem)
      const subs = await this.prisma.userSubscription.findMany({
        where: { prestadorId },
      });

      if (!subs.length) {
        this.logger.log(
          `ℹ Notificação de recusa salva no banco. Prestador ${prestadorId} sem subscription para push.`,
        );
        return notification;
      }

      const payload = JSON.stringify({
        title: '📝 Proposta não selecionada',
        body: `Sua proposta para ${card.categoria} não foi selecionada. Continue se candidatando!`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/tudu-professional/home',
        data: {
          id_pedido,
          type: 'CANDIDATURA_RECUSADA',
          status: 'CANDIDATURE_REJECTED',
        },
      });

      let pushEnviados = 0;
      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          pushEnviados++;
        } catch (err) {
          this.logger.error('❌ Erro enviando notificação de recusa:', err);
        }
      }

      this.logger.log(
        `✅ ${pushEnviados} pushes de candidatura recusada enviados para prestador ${prestadorId}`,
      );
      return notification;
    } catch (err) {
      this.logger.error('❌ Erro notificarCandidaturaRecusada:', err);
      throw err;
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA PRESTADORES CANDIDATOS SOBRE CANCELAMENTO (COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async notificarPrestadoresCancelamentoCard(
    candidaturas: any[],
    id_pedido: string,
    card: any,
  ) {
    try {
      // Agrupa prestadores únicos
      const prestadoresUnicos = candidaturas.reduce((unique, candidatura) => {
        if (
          candidatura.Prestador &&
          !unique.some((p) => p.id_prestador === candidatura.prestador_id)
        ) {
          unique.push({
            id_prestador: candidatura.prestador_id,
            nome: candidatura.Prestador.nome,
            sobrenome: candidatura.Prestador.sobrenome,
          });
        }
        return unique;
      }, []);

      this.logger.log(
        `📢 Processando notificações para ${prestadoresUnicos.length} prestadores sobre cancelamento`,
      );

      for (const prestador of prestadoresUnicos) {
        // ✅ 1. Verifica se já existe notificação recente para este prestador
        const existingNotification = await this.prisma.notification.findFirst({
          where: {
            prestadorId: prestador.id_prestador,
            id_pedido,
            status: 'CARD_CANCELLED',
            createdAt: {
              gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
            },
          },
        });

        if (existingNotification) {
          this.logger.log(
            `ℹ Notificação de cancelamento já existe para prestador ${prestador.id_prestador}`,
          );
          continue;
        }

        // ✅ 2. Cria APENAS UMA notificação no banco para cada prestador
        await this.prisma.notification.create({
          data: {
            title: `❌ Pedido cancelado`,
            body: `O pedido de ${card.categoria} que você se candidatou foi cancelado.`,
            icon: '/assets/icons/icon-192x192.png',
            id_pedido,
            prestadorId: prestador.id_prestador,
            status: 'CARD_CANCELLED',
            metadata: JSON.stringify({
              prestadorNome: `${prestador.nome} ${prestador.sobrenome}`,
              categoria: card.categoria,
            }),
          },
        });

        // ✅ 3. Busca subscriptions para push
        const subs = await this.prisma.userSubscription.findMany({
          where: { prestadorId: prestador.id_prestador },
        });

        if (!subs.length) {
          this.logger.log(
            `ℹ Notificação de cancelamento salva no banco para prestador ${prestador.id_prestador}`,
          );
          continue;
        }

        const payload = JSON.stringify({
          title: '❌ Pedido cancelado',
          body: `O pedido de ${card.categoria} foi cancelado pelo cliente.`,
          icon: '/assets/icons/icon-192x192.png',
          url: '/tudu-professional/home',
          data: {
            id_pedido,
            type: 'CARD_CANCELADO',
            categoria: card.categoria,
            status: 'CARD_CANCELLED',
          },
        });

        for (const s of subs) {
          const sub = JSON.parse(s.subscriptionJson);
          try {
            await webpush.sendNotification(sub, payload);
          } catch (err) {
            this.logger.error(
              `❌ Erro enviando push para prestador ${prestador.id_prestador}:`,
              err,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error('❌ Erro notificarPrestadoresCancelamentoCard:', err);
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA PRESTADOR CONTRATADO SOBRE CANCELAMENTO (COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async notificarPrestadorContratadoCancelamento(
    prestadorId: number,
    id_pedido: string,
    card: any,
  ) {
    try {
      // ✅ 1. Verifica se já existe notificação recente
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          prestadorId,
          id_pedido,
          status: 'CONTRACT_CANCELLED',
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
          },
        },
      });

      if (existingNotification) {
        this.logger.log(
          `ℹ Notificação de cancelamento de contrato já existe para prestador ${prestadorId}`,
        );
        return existingNotification;
      }

      // ✅ 2. Cria APENAS UMA notificação no banco
      const notification = await this.prisma.notification.create({
        data: {
          title: `❌ Contrato cancelado`,
          body: `O pedido de ${card.categoria} que você estava executando foi cancelado.`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido,
          prestadorId,
          status: 'CONTRACT_CANCELLED',
        },
      });

      // ✅ 3. Busca subscriptions para push
      const subs = await this.prisma.userSubscription.findMany({
        where: { prestadorId },
      });

      if (!subs.length) {
        this.logger.log(
          `ℹ Notificação de cancelamento de contrato salva no banco para prestador ${prestadorId}`,
        );
        return notification;
      }

      const payload = JSON.stringify({
        title: '❌ Contrato cancelado',
        body: `O pedido de ${card.categoria} foi cancelado pelo cliente.`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/tudu-professional/home',
        data: {
          id_pedido,
          type: 'CONTRATO_CANCELADO',
          categoria: card.categoria,
          status: 'CONTRACT_CANCELLED',
        },
      });

      let pushEnviados = 0;
      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          pushEnviados++;
        } catch (err) {
          this.logger.error(
            `❌ Erro enviando push para prestador ${prestadorId}:`,
            err,
          );
        }
      }

      this.logger.log(
        `✅ ${pushEnviados} pushes de cancelamento de contrato enviados para prestador ${prestadorId}`,
      );
      return notification;
    } catch (err) {
      this.logger.error(
        '❌ Erro notificarPrestadorContratadoCancelamento:',
        err,
      );
      throw err;
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA CLIENTE SOBRE CANCELAMENTO DE CANDIDATURA (COM DEDUPLICAÇÃO)
   *  ------------------------------------------------------------------ */
  async notificarClienteCancelamentoCandidatura(
    clienteId: number,
    id_pedido: string,
    prestador: any,
    card: any,
  ) {
    try {
      // ✅ 1. Verifica se já existe notificação recente
      const existingNotification = await this.prisma.notification.findFirst({
        where: {
          clienteId,
          id_pedido,
          status: 'CANDIDATURE_CANCELLED',
          createdAt: {
            gte: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
          },
        },
      });

      if (existingNotification) {
        this.logger.log(
          `ℹ Notificação de cancelamento de candidatura já existe para cliente ${clienteId}`,
        );
        return existingNotification;
      }

      // ✅ 2. Cria APENAS UMA notificação no banco
      const notification = await this.prisma.notification.create({
        data: {
          title: `📝 Candidatura cancelada`,
          body: `${prestador.nome} cancelou a proposta no seu pedido.`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido,
          clienteId,
          status: 'CANDIDATURE_CANCELLED',
          metadata: JSON.stringify({
            prestadorNome: prestador.nome,
            categoria: card.categoria,
          }),
        },
      });

      // ✅ 3. Busca subscriptions para push
      const subs = await this.prisma.userSubscription.findMany({
        where: { clienteId },
      });

      if (!subs.length) {
        this.logger.log(
          `ℹ Notificação de cancelamento de candidatura salva no banco para cliente ${clienteId}`,
        );
        return notification;
      }

      const payload = JSON.stringify({
        title: '📝 Candidatura cancelada',
        body: `${prestador.nome} cancelou a proposta no seu pedido de ${card.categoria}.`,
        icon: '/assets/icons/icon-192x192.png',
        url: this.buildNotificationUrl(id_pedido),
        data: {
          id_pedido,
          type: 'CANDIDATURA_CANCELADA',
          prestadorNome: `${prestador.nome}`,
          status: 'CANDIDATURE_CANCELLED',
        },
      });

      let pushEnviados = 0;
      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          pushEnviados++;
        } catch (err) {
          this.logger.error(
            '❌ Erro enviando notificação de cancelamento:',
            err,
          );
        }
      }

      this.logger.log(
        `✅ ${pushEnviados} pushes de cancelamento de candidatura enviados para cliente ${clienteId}`,
      );
      return notification;
    } catch (err) {
      this.logger.error(
        '❌ Erro notificarClienteCancelamentoCandidatura:',
        err,
      );
      throw err;
    }
  }

  /** ------------------------------------------------------------------
   *  🧪 TEST NOTIFICATION
   *  ------------------------------------------------------------------ */
  async testNotification(clienteId: number, prestadorId: number) {
    return this.sendNotification({
      title: 'Test Push',
      body: 'Funcionou!',
      icon: '/assets/icons/icon-192x192.png',
      id_pedido: 'test-123',
      clienteId,
      prestadorId,
      status: 'TEST',
    });
  }

  /** ------------------------------------------------------------------
   *  ✅ MARCA NOTIFICAÇÃO COMO LIDA
   *  ------------------------------------------------------------------ */
  async markAsRead(id: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return {
      ...updatedNotification,
      id_pedido: notification.id_pedido,
    };
  }

  async markAllAsRead(clienteId?: number, prestadorId?: number) {
    const where: any = { read: false };

    if (clienteId !== undefined) {
      where.clienteId = clienteId;
    }

    if (prestadorId !== undefined) {
      where.prestadorId = prestadorId;
    }

    return this.prisma.notification.updateMany({
      where,
      data: { read: true },
    });
  }

  async countUnread(clienteId?: number, prestadorId?: number) {
    const where: any = { read: false };

    if (clienteId !== undefined) {
      where.clienteId = clienteId;
    }

    if (prestadorId !== undefined) {
      where.prestadorId = prestadorId;
    }

    return this.prisma.notification.count({ where });
  }

  async findOne(id: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        Cliente: {
          select: {
            nome: true,
          },
        },
        Prestador: {
          select: {
            nome: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
    }

    return notification;
  }

  /** ------------------------------------------------------------------
   *  🔧 MÉTODO AUXILIAR: CONSTRÓI URL
   *  ------------------------------------------------------------------ */
  private buildNotificationUrl(id_pedido: string): string {
    return `/home/budgets?id=${id_pedido}&flow=publicado`;
  }

  /** ------------------------------------------------------------------
   *  🐛 DEBUG: VERIFICA NOTIFICAÇÕES DUPLICADAS
   *  ------------------------------------------------------------------ */
  // async debugNotificationIssue(cardId: string) {
  //   const recentNotifications = await this.prisma.notification.findMany({
  //     where: {
  //       id_pedido: cardId,
  //       status: 'NEW_CARD',
  //       createdAt: {
  //         gte: new Date(Date.now() - 5 * 60 * 1000), // Últimos 5 minutos
  //       },
  //     },
  //     orderBy: { createdAt: 'desc' },
  //     include: {
  //       Prestador: {
  //         select: { nome: true },
  //       },
  //     },
  //   });

  //   this.logger.log('🔍 DEBUG - Notificações duplicadas encontradas:');
  //   this.logger.log(`Card: ${cardId}`);
  //   this.logger.log(`Total notificações: ${recentNotifications.length}`);

  //   // Agrupa por prestador
  //   const porPrestador = recentNotifications.reduce((acc, notif) => {
  //     const key = notif.prestadorId || 'null';
  //     if (!acc[key]) acc[key] = [];
  //     acc[key].push(notif);
  //     return acc;
  //   }, {});

  //   for (const [prestadorId, notifs] of Object.entries(porPrestador)) {
  //     this.logger.log(
  //       `\nPrestador ${prestadorId}: ${notifs.length} notificações`,
  //     );
  //     notifs.forEach((n: any, i) => {
  //       this.logger.log(
  //         `  ${i + 1}. ID: ${n.id}, Criada: ${n.createdAt}, Prestador: ${n.Prestador?.nome}`,
  //       );
  //     });
  //   }

  //   return {
  //     cardId,
  //     totalNotifications: recentNotifications.length,
  //     byPrestador: porPrestador,
  //   };
  // }
}
