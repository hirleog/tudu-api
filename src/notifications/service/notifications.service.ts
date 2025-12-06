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
   *  🔔 SALVA NOTIFICAÇÃO NO BANCO (SEMPRE)
   *  ------------------------------------------------------------------ */
  async create(data: CreateNotificationData) {
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
    try {
      const safeClienteId = this.safeParseId(clienteId);
      const safePrestadorId = this.safeParseId(prestadorId);

      if (!safeClienteId && !safePrestadorId) {
        throw new Error('É necessário fornecer clienteId OU prestadorId');
      }

      const endpoint = subscription?.endpoint;
      if (!endpoint) {
        throw new Error('Subscription inválida: faltando endpoint');
      }

      // ✅ Busca por ENDPOINT (único por dispositivo)
      const existing = await this.prisma.userSubscription.findFirst({
        where: {
          subscriptionJson: {
            contains: endpoint, // Procura pelo endpoint no JSON
          },
        },
      });

      let result;
      let action = 'created';

      if (existing) {
        // ✅ SE JÁ EXISTE: ATUALIZA
        console.log(`🔄 Atualizando subscription existente: ${existing.id}`);
        result = await this.prisma.userSubscription.update({
          where: { id: existing.id },
          data: {
            clienteId: safeClienteId,
            prestadorId: safePrestadorId,
            subscriptionJson: JSON.stringify(subscription),
          },
        });
        action = 'updated';
      } else {
        // ✅ SE NÃO EXISTE: CRIA NOVA
        console.log(
          `🆕 Criando nova subscription para endpoint: ${endpoint.substring(0, 50)}...`,
        );
        result = await this.prisma.userSubscription.create({
          data: {
            clienteId: safeClienteId,
            prestadorId: safePrestadorId,
            subscriptionJson: JSON.stringify(subscription),
          },
        });
      }

      return {
        success: true,
        subscriptionId: result.id,
        action: action,
        updated: action === 'updated',
        endpoint: endpoint,
      };
    } catch (err) {
      console.error('Erro no sendSubscriptionToServer:', err);
      throw err;
    }
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
   *  🔔 ENVIA PUSH PARA UM USUÁRIO ESPECÍFICO
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

    // ✅ 1. SEMPRE salva a notificação no banco (para a central)
    const notification = await this.create({
      title,
      body,
      icon,
      id_pedido,
      clienteId,
      prestadorId,
      status,
    });

    // ✅ 2. Busca subscriptions para enviar push (se existirem)
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

    // ✅ 3. BUSCA IMAGENS DO CARD PARA INCLUIR NO PUSH
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

    // ✅ 4. Prepara payload do push
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

    // ✅ 5. Envia push para todas as subscriptions do usuário
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
   *  🔔 ENVIA PUSH PARA TODOS OS PRESTADORES (OTIMIZADO)
   *  ------------------------------------------------------------------ */
  async sendCardCreatedPushOptimized(card: any) {
    this.logger.log(
      `🔔 Enviando HEADS-UP push para PRESTADORES - Card: ${card.id_pedido}`,
    );

    // ✅ 1. Busca todos os prestadores ÚNICOS com uma query otimizada
    const prestadoresUnicos = await this.prisma.userSubscription.groupBy({
      by: ['prestadorId'],
      where: {
        prestadorId: { not: null },
      },
      _count: {
        id: true,
      },
    });

    if (!prestadoresUnicos.length) {
      this.logger.warn('⚠ Nenhum prestador com subscription encontrado.');
      return {
        success: false,
        message: 'Nenhum prestador com subscription encontrado',
        totalPrestadores: 0,
      };
    }

    // ✅ 2. Para cada prestador, busca TODAS suas subscriptions
    const resultados: Array<{
      prestadorId: number;
      notificacaoCriada: boolean;
      pushEnviados: number;
      totalDispositivos: number;
      sucesso: boolean;
    }> = [];

    for (const grupo of prestadoresUnicos) {
      const prestadorId = grupo.prestadorId!;
      const totalDispositivos = grupo._count.id;

      // ✅ 3. Busca todas as subscriptions deste prestador específico
      const subscriptionsDoPrestador =
        await this.prisma.userSubscription.findMany({
          where: {
            prestadorId: prestadorId,
          },
        });

      // ✅ 4. VERIFICAÇÃO DE DUPLICAÇÃO COM LOCK (usando transação)
      const notificacaoExistente = await this.prisma.$transaction(
        async (tx) => {
          // Primeiro verifica se já existe notificação recente
          const existente = await tx.notification.findFirst({
            where: {
              prestadorId: prestadorId,
              id_pedido: card.id_pedido,
              status: 'NEW_CARD',
              createdAt: {
                gte: new Date(Date.now() - 30 * 60 * 1000), // Últimos 30 minutos
              },
            },
          });

          // Se já existe, retorna e não cria nova
          if (existente) {
            this.logger.log(
              `⏭️ Notificação já existe para prestador ${prestadorId} e card ${card.id_pedido} (ID: ${existente.id})`,
            );
            return existente;
          }

          // Se não existe, cria UMA nova
          const novaNotificacao = await tx.notification.create({
            data: {
              title: '🎯 NOVO PEDIDO DISPONÍVEL!',
              body: `${card.categoria} - R$ ${card.valor} - ${card.city}, ${card.state}`,
              icon: '/assets/icons/icon-192x192.png',
              id_pedido: card.id_pedido,
              prestadorId: prestadorId,
              read: false,
              status: 'NEW_CARD',
              metadata: JSON.stringify({
                isHeadsUp: true,
                cardId: card.id_pedido,
                categoria: card.categoria,
                valor: card.valor,
                cidade: card.city,
              }),
            },
          });

          this.logger.log(
            `📝 Notificação criada para prestador ${prestadorId} (ID: ${novaNotificacao.id})`,
          );

          return novaNotificacao;
        },
      );

      // Se a notificação já existia (foi encontrada), marca como não criada
      const notificacaoCriada =
        notificacaoExistente.id === undefined ||
        notificacaoExistente.createdAt < new Date(Date.now() - 5 * 1000); // Se criada há menos de 5 segundos

      // ✅ 5. Envia push para todos os dispositivos do prestador (independente de ter criado notificação)
      let pushEnviados = 0;
      let algumPushSucesso = false;

      // Prepara payload
      const pushPayload = {
        title: '🎯 NOVO PEDIDO DISPONÍVEL!',
        body: `${card.categoria} - R$ ${card.valor} - ${card.city}, ${card.state}`,
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge-72x72.png',
        requireInteraction: true,
        tag: `new-card-${card.id_pedido}-${prestadorId}-${Date.now()}`,
        data: {
          id_pedido: card.id_pedido,
          url: '/tudu-professional/home',
          status: 'NEW_CARD',
        },
      };

      for (const subscription of subscriptionsDoPrestador) {
        try {
          const subData = JSON.parse(subscription.subscriptionJson);
          await webpush.sendNotification(subData, JSON.stringify(pushPayload));
          pushEnviados++;
          algumPushSucesso = true;
        } catch (err) {
          this.logger.error(
            `❌ Erro no push para prestador ${prestadorId}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      resultados.push({
        prestadorId,
        notificacaoCriada: notificacaoCriada,
        pushEnviados,
        totalDispositivos,
        sucesso: algumPushSucesso,
      });
    }

    // ✅ 6. Estatísticas
    const totalPrestadores = prestadoresUnicos.length;
    const notificacoesCriadas = resultados.filter(
      (r) => r.notificacaoCriada,
    ).length;
    const totalPushEnviados = resultados.reduce(
      (sum, r) => sum + r.pushEnviados,
      0,
    );

    this.logger.log(
      `🎉 FINAL: ${notificacoesCriadas} notificações criadas para ${totalPrestadores} prestadores, ` +
        `${totalPushEnviados} pushes enviados`,
    );

    return {
      success: notificacoesCriadas > 0,
      totalPrestadores,
      notificacoesCriadas,
      totalPushEnviados,
      resultadosDetalhados: resultados,
    };
  }
  /** ------------------------------------------------------------------
   *  🔔 ENVIA PUSH PARA NOVA CANDIDATURA
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
      // ✅ 1. Busca subscriptions do cliente
      const subs = await this.prisma.userSubscription.findMany({
        where: { clienteId },
      });

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

      const pushBody = isAtualizacao
        ? `${prestador.nome} te fez uma nova proposta.`
        : `${prestador.nome} enviou uma proposta no seu pedido.`;

      const status = isAtualizacao ? 'CANDIDATURE_UPDATED' : 'NEW_CANDIDATURE';

      // ✅ 4. SEMPRE salva a notificação no banco
      await this.prisma.notification.create({
        data: {
          title: title,
          body: body,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          clienteId,
          status: status,
          metadata: JSON.stringify({
            imagens,
            isAtualizacao,
            prestadorNome: prestador.nome,
            valorProposta: candidatura.valor_negociado,
          }),
        },
      });

      // ✅ 5. Se não há subscriptions, retorna (notificação já está salva)
      if (!subs.length) {
        console.log(
          `ℹ Notificação salva no banco. Cliente ${clienteId} sem subscription para push.`,
        );
        return;
      }

      // ✅ 6. Prepara payload do push
      const payload = JSON.stringify({
        title: title,
        body: pushBody,
        icon: '/assets/icons/icon-192x192.png',
        url: this.buildNotificationUrl(id_pedido),
        data: {
          id_pedido: id_pedido,
          type: isAtualizacao ? 'CANDIDATURA_ATUALIZADA' : 'NEW_CANDIDATURE',
          isAtualizacao: isAtualizacao,
          imagens,
          status: status,
        },
      });

      // ✅ 7. Envia push para todas as subscriptions
      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);

        try {
          await webpush.sendNotification(sub, payload);
          console.log(
            `✅ Push ${isAtualizacao ? 'atualização' : 'nova'} enviado com id_pedido:`,
            id_pedido,
            `e ${imagens.length} imagens`,
          );
        } catch (err) {
          console.error('❌ Erro enviando push:', err);
        }
      }
    } catch (err) {
      console.error('❌ Erro enviarPushNovaCandidatura:', err);
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA CLIENTE SOBRE CONTRATAÇÃO
   *  ------------------------------------------------------------------ */
  async notificarClienteContratacao(
    clienteId: number,
    id_pedido: string,
    prestador: any,
    card: any,
  ) {
    try {
      // ✅ 1. Busca subscriptions do cliente
      const subs = await this.prisma.userSubscription.findMany({
        where: { clienteId },
      });

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

      // ✅ 3. SEMPRE salva a notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `🎉 Contratação confirmada!`,
          body: `${prestador.nome} foi contratado para o seu serviço.`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          clienteId,
          status: 'HIRE_CONFIRMED',
          metadata: JSON.stringify({
            imagens,
            prestadorNome: prestador.nome,
            categoria: card.categoria,
          }),
        },
      });

      // ✅ 4. Se não há subscriptions, retorna
      if (!subs.length) {
        console.log(
          `ℹ Notificação de contratação salva no banco. Cliente ${clienteId} sem subscription para push.`,
        );
        return;
      }

      // ✅ 5. Prepara e envia push
      const payload = JSON.stringify({
        title: '🎉 Contratação confirmada!',
        body: `Seu pedido está em andamento com ${prestador.nome}.`,
        icon: '/assets/icons/icon-192x192.png',
        url: this.buildNotificationUrl(id_pedido),
        data: {
          id_pedido: id_pedido,
          type: 'CONTRATACAO_CONFIRMADA',
          imagens,
          status: 'HIRE_CONFIRMED',
        },
      });

      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          console.log(
            '✅ Push de contratação enviado para cliente com',
            imagens.length,
            'imagens',
          );
        } catch (err) {
          console.error('❌ Erro enviando notificação de contratação:', err);
        }
      }
    } catch (err) {
      console.error('❌ Erro notificarClienteContratacao:', err);
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA PRESTADOR SOBRE CONTRATAÇÃO
   *  ------------------------------------------------------------------ */
  async notificarPrestadorContratacao(
    prestadorId: number,
    id_pedido: string,
    card: any,
  ) {
    try {
      // ✅ 1. Busca subscriptions do prestador
      const subs = await this.prisma.userSubscription.findMany({
        where: { prestadorId },
      });

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

      // ✅ 3. SEMPRE salva a notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `🚀 Você foi contratado!`,
          body: `Parabéns! Você foi selecionado para o serviço de ${card.categoria}.`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          prestadorId,
          status: 'PROVIDER_HIRED',
          metadata: JSON.stringify({
            imagens,
            categoria: card.categoria,
          }),
        },
      });

      // ✅ 4. Se não há subscriptions, retorna
      if (!subs.length) {
        console.log(
          `ℹ Notificação de contratação salva no banco. Prestador ${prestadorId} sem subscription para push.`,
        );
        return;
      }

      // ✅ 5. Prepara e envia push
      const payload = JSON.stringify({
        title: '🚀 Você foi contratado!',
        body: `Seu serviço de ${card.categoria} está aguardando confirmação.`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/tudu-professional/home',
        data: {
          id_pedido: id_pedido,
          type: 'PRESTADOR_CONTRATADO',
          imagens,
          status: 'PROVIDER_HIRED',
        },
      });

      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          console.log(
            '✅ Push de contratação enviado para prestador com',
            imagens.length,
            'imagens',
          );
        } catch (err) {
          console.error('❌ Erro enviando notificação para prestador:', err);
        }
      }
    } catch (err) {
      console.error('❌ Erro notificarPrestadorContratacao:', err);
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA CANDIDATURA RECUSADA
   *  ------------------------------------------------------------------ */
  async notificarCandidaturaRecusada(
    prestadorId: number,
    id_pedido: string,
    card: any,
  ) {
    try {
      // ✅ SEMPRE salva a notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `📝 Proposta não selecionada`,
          body: `Sua proposta para ${card.categoria} não foi selecionada. Faça uma nova proposta!`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          prestadorId,
          status: 'CANDIDATURE_REJECTED',
        },
      });

      // ✅ Busca subscriptions para push (se existirem)
      const subs = await this.prisma.userSubscription.findMany({
        where: { prestadorId },
      });

      if (!subs.length) {
        console.log(
          `ℹ Notificação de recusa salva no banco. Prestador ${prestadorId} sem subscription para push.`,
        );
        return;
      }

      const payload = JSON.stringify({
        title: '📝 Proposta não selecionada',
        body: `Sua proposta para ${card.categoria} não foi selecionada. Continue se candidatando!`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/tudu-professional/home',
        data: {
          id_pedido: id_pedido,
          type: 'CANDIDATURA_RECUSADA',
          status: 'CANDIDATURE_REJECTED',
        },
      });

      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          console.log('✅ Push de candidatura recusada enviado');
        } catch (err) {
          console.error('❌ Erro enviando notificação de recusa:', err);
        }
      }
    } catch (err) {
      console.error('❌ Erro notificarCandidaturaRecusada:', err);
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA PRESTADORES CANDIDATOS SOBRE CANCELAMENTO
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

      console.log(
        `📢 Processando notificações para ${prestadoresUnicos.length} prestadores sobre cancelamento`,
      );

      for (const prestador of prestadoresUnicos) {
        // ✅ SEMPRE salva a notificação no banco para cada prestador
        await this.prisma.notification.create({
          data: {
            title: `❌ Pedido cancelado`,
            body: `O pedido de ${card.categoria} que você se candidatou foi cancelado.`,
            icon: '/assets/icons/icon-192x192.png',
            id_pedido: id_pedido,
            prestadorId: prestador.id_prestador,
            status: 'CARD_CANCELLED',
            metadata: JSON.stringify({
              prestadorNome: `${prestador.nome} ${prestador.sobrenome}`,
              categoria: card.categoria,
            }),
          },
        });

        // ✅ Busca subscriptions para push
        const subs = await this.prisma.userSubscription.findMany({
          where: { prestadorId: prestador.id_prestador },
        });

        if (!subs.length) {
          console.log(
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
            id_pedido: id_pedido,
            type: 'CARD_CANCELADO',
            categoria: card.categoria,
            status: 'CARD_CANCELLED',
          },
        });

        for (const s of subs) {
          const sub = JSON.parse(s.subscriptionJson);
          try {
            await webpush.sendNotification(sub, payload);
            console.log(
              `✅ Push de cancelamento enviado para prestador ${prestador.id_prestador}`,
            );
          } catch (err) {
            console.error(
              `❌ Erro enviando push para prestador ${prestador.id_prestador}:`,
              err,
            );
          }
        }
      }
    } catch (err) {
      console.error('❌ Erro notificarPrestadoresCancelamentoCard:', err);
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA PRESTADOR CONTRATADO SOBRE CANCELAMENTO
   *  ------------------------------------------------------------------ */
  async notificarPrestadorContratadoCancelamento(
    prestadorId: number,
    id_pedido: string,
    card: any,
  ) {
    try {
      // ✅ SEMPRE salva a notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `❌ Contrato cancelado`,
          body: `O pedido de ${card.categoria} que você estava executando foi cancelado.`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          prestadorId,
          status: 'CONTRACT_CANCELLED',
        },
      });

      // ✅ Busca subscriptions para push
      const subs = await this.prisma.userSubscription.findMany({
        where: { prestadorId },
      });

      if (!subs.length) {
        console.log(
          `ℹ Notificação de cancelamento de contrato salva no banco para prestador ${prestadorId}`,
        );
        return;
      }

      const payload = JSON.stringify({
        title: '❌ Contrato cancelado',
        body: `O pedido de ${card.categoria} foi cancelado pelo cliente.`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/tudu-professional/home',
        data: {
          id_pedido: id_pedido,
          type: 'CONTRATO_CANCELADO',
          categoria: card.categoria,
          status: 'CONTRACT_CANCELLED',
        },
      });

      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          console.log(
            `✅ Push de cancelamento de contrato enviado para prestador ${prestadorId}`,
          );
        } catch (err) {
          console.error(
            `❌ Erro enviando push para prestador ${prestadorId}:`,
            err,
          );
        }
      }
    } catch (err) {
      console.error('❌ Erro notificarPrestadorContratadoCancelamento:', err);
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA CLIENTE SOBRE CANCELAMENTO DE CANDIDATURA
   *  ------------------------------------------------------------------ */
  async notificarClienteCancelamentoCandidatura(
    clienteId: number,
    id_pedido: string,
    prestador: any,
    card: any,
  ) {
    try {
      // ✅ SEMPRE salva a notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `📝 Candidatura cancelada`,
          body: `${prestador.nome} cancelou a proposta no seu pedido.`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          clienteId,
          status: 'CANDIDATURE_CANCELLED',
          metadata: JSON.stringify({
            prestadorNome: prestador.nome,
            categoria: card.categoria,
          }),
        },
      });

      // ✅ Busca subscriptions para push
      const subs = await this.prisma.userSubscription.findMany({
        where: { clienteId },
      });

      if (!subs.length) {
        console.log(
          `ℹ Notificação de cancelamento de candidatura salva no banco para cliente ${clienteId}`,
        );
        return;
      }

      const payload = JSON.stringify({
        title: '📝 Candidatura cancelada',
        body: `${prestador.nome} cancelou a proposta no seu pedido de ${card.categoria}.`,
        icon: '/assets/icons/icon-192x192.png',
        url: this.buildNotificationUrl(id_pedido),
        data: {
          id_pedido: id_pedido,
          type: 'CANDIDATURA_CANCELADA',
          prestadorNome: `${prestador.nome}`,
          status: 'CANDIDATURE_CANCELLED',
        },
      });

      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          console.log(
            '✅ Push de cancelamento de candidatura enviado para cliente',
          );
        } catch (err) {
          console.error('❌ Erro enviando notificação de cancelamento:', err);
        }
      }
    } catch (err) {
      console.error('❌ Erro notificarClienteCancelamentoCandidatura:', err);
    }
  }

  async notificarServicoFinalizado(id_pedido: string, card: any) {
    try {
      // Busca dados do card com relacionamentos
      const cardCompleto = await this.buscarCardCompleto(id_pedido);
      if (!cardCompleto) return;

      // Busca imagens do card
      const imagens = await this.buscarImagensCard(id_pedido);

      // 🔔 NOTIFICA O CLIENTE (DONO DA NOTIFICAÇÃO)
      if (cardCompleto.id_cliente) {
        await this.notificarCliente(
          cardCompleto.id_cliente,
          id_pedido,
          card.categoria,
          imagens,
        );

        // 🔔 NOTIFICA O PRESTADOR (RECEBE A MESMA NOTIFICAÇÃO)

        await this.notificarPrestador(
          cardCompleto.id_prestador,
          id_pedido,
          card.categoria,
          imagens,
        );
      }

      console.log(
        `✅ Notificações de serviço finalizado processadas para card ${id_pedido}`,
      );
    } catch (err) {
      console.error('❌ Erro notificarServicoFinalizado:', err);
    }
  }

  // 🔧 MÉTODOS AUXILIARES (PRIVATE)

  private async buscarCardCompleto(id_pedido: string) {
    const cardCompleto = await this.prisma.card.findUnique({
      where: { id_pedido },
      include: {
        Cliente: true,
        Prestador: true,
      },
    });

    if (!cardCompleto) {
      console.error(`❌ Card ${id_pedido} não encontrado`);
    }

    return cardCompleto;
  }

  private async buscarImagensCard(id_pedido: string): Promise<string[]> {
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
      return cardWithImages.imagens.map((img) => img.url);
    }

    return [];
  }

  private async notificarCliente(
    clienteId: number,
    id_pedido: string,
    categoria: string,
    imagens: string[],
  ) {
    // Busca subscriptions do cliente
    const subsCliente = await this.prisma.userSubscription.findMany({
      where: { clienteId },
    });

    // ✅ SEMPRE salva a notificação no banco para o cliente (DONO)
    await this.prisma.notification.create({
      data: {
        title: `✅ Serviço concluído!`,
        body: `Seu serviço de ${categoria} foi finalizado com sucesso.`,
        icon: '/assets/icons/icon-192x192.png',
        id_pedido: id_pedido,
        clienteId: clienteId, // Cliente é o dono
        status: 'SERVICE_COMPLETED',
        metadata: JSON.stringify({
          imagens,
          categoria,
        }),
      },
    });

    // ✅ Se houver subscriptions, envia push
    if (subsCliente.length > 0) {
      await this.enviarPushNotification(
        subsCliente,
        '✅ Serviço concluído!',
        `Seu serviço de ${categoria} foi finalizado com sucesso.`,
        this.buildNotificationUrl(id_pedido),
        id_pedido,
        imagens,
        'cliente',
      );
    }
  }

  private async notificarPrestador(
    prestadorId: number,
    id_pedido: string,
    categoria: string,
    imagens: string[],
  ) {
    // Busca subscriptions do prestador
    const subsPrestador = await this.prisma.userSubscription.findMany({
      where: { prestadorId },
    });

    // ✅ SEMPRE salva a notificação no banco para o prestador
    await this.prisma.notification.create({
      data: {
        title: `🎊 Serviço finalizado!`,
        body: `Parabéns! Você concluiu o serviço de ${categoria} com sucesso.`,
        icon: '/assets/icons/icon-192x192.png',
        id_pedido: id_pedido,
        prestadorId: prestadorId, // Prestador também recebe
        status: 'SERVICE_COMPLETED',
        metadata: JSON.stringify({
          imagens,
          categoria,
        }),
      },
    });

    // ✅ Se houver subscriptions, envia push
    if (subsPrestador.length > 0) {
      await this.enviarPushNotification(
        subsPrestador,
        '🎊 Serviço finalizado!',
        `Parabéns! Você concluiu o serviço de ${categoria} com sucesso.`,
        '/tudu-professional/home',
        id_pedido,
        imagens,
        'prestador',
      );
    }
  }

  private async enviarPushNotification(
    subscriptions: any[],
    title: string,
    body: string,
    url: string,
    id_pedido: string,
    imagens: string[],
    tipoUsuario: string,
  ) {
    const payload = JSON.stringify({
      title,
      body,
      icon: '/assets/icons/icon-192x192.png',
      url,
      data: {
        id_pedido: id_pedido,
        type: 'SERVICO_FINALIZADO',
        imagens,
        status: 'SERVICE_COMPLETED',
      },
    });

    for (const s of subscriptions) {
      const sub = JSON.parse(s.subscriptionJson);
      try {
        await webpush.sendNotification(sub, payload);
        console.log(
          `✅ Push de serviço finalizado enviado para ${tipoUsuario}`,
        );
      } catch (err) {
        console.error(`❌ Erro enviando notificação para ${tipoUsuario}:`, err);
      }
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
}
