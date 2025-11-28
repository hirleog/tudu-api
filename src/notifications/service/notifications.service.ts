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
    id_pedido: string;
    clienteId?: number;
    prestadorId?: number;
  }) {
    return this.prisma.notification.create({ data });
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
    id_pedido,
    clienteId,
    prestadorId,
  }: {
    title: string;
    body: string;
    icon: string;
    id_pedido: string;
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
      id_pedido,
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
      // ✅ BUSCA IMAGENS DO CARD PARA INCLUIR NO PUSH
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

      const pushPayload = {
        title,
        body,
        icon,
        url: this.buildNotificationUrl(id_pedido),
        data: {
          id_pedido,
          type: 'GENERAL_NOTIFICATION',
          imagens, // ✅ INCLUI IMAGENS NO PUSH
        },
      };

      await webpush.sendNotification(
        JSON.parse(user.subscriptionJson),
        JSON.stringify(pushPayload),
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

    // ✅ BUSCA IMAGENS DO CARD
    let imagens: string[] = [];
    if (card.id_pedido) {
      const cardWithImages = await this.prisma.card.findUnique({
        where: { id_pedido: card.id_pedido },
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
        id_pedido: card.id_pedido,
        url: '/tudu-professional/home',
        categoria: card.categoria,
        valor: card.valor,
        cidade: card.city,
        imagens, // ✅ INCLUI IMAGENS NO PUSH
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
              id_pedido: card.id_pedido,
              prestadorId: subscription.prestadorId,
              read: false,
              // ✅ Marca como heads-up no banco também
              metadata: JSON.stringify({
                isHeadsUp: true,
                cardId: card.id_pedido,
                imagens, // ✅ SALVA IMAGENS NO METADATA
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
    isAtualizacao: boolean = false,
  ) {
    try {
      // 📌 Busca todas as subscriptions do dono do card
      const subs = await this.prisma.userSubscription.findMany({
        where: { clienteId },
      });

      if (!subs.length) {
        return; // Nenhum dispositivo inscrito
      }

      // ✅ BUSCA IMAGENS DO CARD
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

      // Mensagens diferentes para nova candidatura vs atualização
      const title = isAtualizacao
        ? '📝 Proposta atualizada'
        : '📨 Nova candidatura';

      const body = isAtualizacao
        ? `${prestador.nome} mandou nova proposta de R$ ${candidatura.valor_negociado}`
        : `${prestador.nome} ofereceu R$ ${candidatura.valor_negociado}`;

      const pushBody = isAtualizacao
        ? `${prestador.nome} te fez uma nova proposta.`
        : `${prestador.nome} enviou uma proposta no seu pedido.`;

      // 📌 Cria registro da notificação no banco
      await this.prisma.notification.create({
        data: {
          title: title,
          body: body,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          clienteId,
          metadata: JSON.stringify({
            imagens, // ✅ SALVA IMAGENS NO METADATA
            isAtualizacao,
          }),
        },
      });

      // ✅ CORRETO: Payload com id_pedido e imagens
      const payload = JSON.stringify({
        title: title,
        body: pushBody,
        icon: '/assets/icons/icon-192x192.png',
        url: this.buildNotificationUrl(id_pedido),
        data: {
          id_pedido: id_pedido,
          type: isAtualizacao ? 'CANDIDATURA_ATUALIZADA' : 'NEW_CANDIDATURE',
          isAtualizacao: isAtualizacao,
          imagens, // ✅ INCLUI IMAGENS NO PUSH
        },
      });

      console.log('📦 Payload completo com imagens:', {
        id_pedido,
        imagensCount: imagens.length,
        primeiraImagem: imagens[0],
      });

      // 📌 Envia o push notification
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
          console.error('Erro enviando push:', err);
        }
      }
    } catch (err) {
      console.error('Erro enviarPushNovaCandidatura:', err);
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
      const subs = await this.prisma.userSubscription.findMany({
        where: { clienteId },
      });

      if (!subs.length) return;

      // ✅ BUSCA IMAGENS DO CARD
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

      // 📌 Cria registro da notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `🎉 Contratação confirmada!`,
          body: `${prestador.nome} foi contratado para o seu serviço.`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          clienteId,
          metadata: JSON.stringify({
            imagens, // ✅ SALVA IMAGENS NO METADATA
            prestadorNome: prestador.nome,
          }),
        },
      });

      const payload = JSON.stringify({
        title: '🎉 Contratação confirmada!',
        body: `Seu pedido está em andamento com ${prestador.nome}.`,
        icon: '/assets/icons/icon-192x192.png',
        url: this.buildNotificationUrl(id_pedido),
        data: {
          id_pedido: id_pedido,
          type: 'CONTRATACAO_CONFIRMADA',
          imagens, // ✅ INCLUI IMAGENS NO PUSH
        },
      });

      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          console.log(
            '✅ Notificação de contratação enviada para cliente com',
            imagens.length,
            'imagens',
          );
        } catch (err) {
          console.error('Erro enviando notificação de contratação:', err);
        }
      }
    } catch (err) {
      console.error('Erro notificarClienteContratacao:', err);
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
      const subs = await this.prisma.userSubscription.findMany({
        where: { prestadorId },
      });

      if (!subs.length) return;

      // ✅ BUSCA IMAGENS DO CARD
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

      // 📌 Cria registro da notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `🚀 Você foi contratado!`,
          body: `Parabéns! Você foi selecionado para o serviço de ${card.categoria}.`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          prestadorId,
          metadata: JSON.stringify({
            imagens, // ✅ SALVA IMAGENS NO METADATA
            categoria: card.categoria,
          }),
        },
      });

      const payload = JSON.stringify({
        title: '🚀 Você foi contratado!',
        body: `Seu serviço de ${card.categoria} está aguardando confirmação.`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/tudu-professional/home',
        data: {
          id_pedido: id_pedido,
          type: 'PRESTADOR_CONTRATADO',
          imagens, // ✅ INCLUI IMAGENS NO PUSH
        },
      });

      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          console.log(
            '✅ Notificação de contratação enviada para prestador com',
            imagens.length,
            'imagens',
          );
        } catch (err) {
          console.error('Erro enviando notificação para prestador:', err);
        }
      }
    } catch (err) {
      console.error('Erro notificarPrestadorContratacao:', err);
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
      const subs = await this.prisma.userSubscription.findMany({
        where: { prestadorId },
      });

      if (!subs.length) return;

      // 📌 Cria registro da notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `📝 Proposta não selecionada`,
          body: `Sua proposta para ${card.categoria} não foi selecionada. Faça uma nova proposta!`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          prestadorId,
        },
      });

      const payload = JSON.stringify({
        title: '📝 Proposta não selecionada',
        body: `Sua proposta para ${card.categoria} não foi selecionada. Continue se candidatando!`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/tudu-professional/home',
        data: {
          id_pedido: id_pedido,
          type: 'CANDIDATURA_RECUSADA',
        },
      });

      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          console.log('✅ Notificação de candidatura recusada enviada');
        } catch (err) {
          console.error('Erro enviando notificação de recusa:', err);
        }
      }
    } catch (err) {
      console.error('Erro notificarCandidaturaRecusada:', err);
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA TODOS OS PRESTADORES CANDIDATOS SOBRE CANCELAMENTO DO CARD
   *  ------------------------------------------------------------------ */
  async notificarPrestadoresCancelamentoCard(
    candidaturas: any[],
    id_pedido: string,
    card: any,
  ) {
    try {
      // Agrupa prestadores únicos para evitar notificações duplicadas
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
        `📢 Notificando ${prestadoresUnicos.length} prestadores sobre cancelamento do card ${id_pedido}`,
      );

      for (const prestador of prestadoresUnicos) {
        const subs = await this.prisma.userSubscription.findMany({
          where: { prestadorId: prestador.id_prestador },
        });

        if (!subs.length) continue;

        // 📌 Cria registro da notificação no banco
        await this.prisma.notification.create({
          data: {
            title: `❌ Pedido cancelado`,
            body: `O pedido de ${card.categoria} que você se candidatou foi cancelado.`,
            icon: '/assets/icons/icon-192x192.png',
            id_pedido: id_pedido,
            prestadorId: prestador.id_prestador,
          },
        });

        const payload = JSON.stringify({
          title: '❌ Pedido cancelado',
          body: `O pedido de ${card.categoria} foi cancelado pelo cliente.`,
          icon: '/assets/icons/icon-192x192.png',
          url: '/tudu-professional/home',
          data: {
            id_pedido: id_pedido,
            type: 'CARD_CANCELADO',
            categoria: card.categoria,
          },
        });

        for (const s of subs) {
          const sub = JSON.parse(s.subscriptionJson);
          try {
            await webpush.sendNotification(sub, payload);
            console.log(
              `✅ Notificação de cancelamento enviada para prestador ${prestador.id_prestador}`,
            );
          } catch (err) {
            console.error(
              `Erro enviando notificação para prestador ${prestador.id_prestador}:`,
              err,
            );
          }
        }
      }
    } catch (err) {
      console.error('Erro notificarPrestadoresCancelamentoCard:', err);
    }
  }

  /** ------------------------------------------------------------------
   *  🔔 NOTIFICA PRESTADOR CONTRATADO SOBRE CANCELAMENTO DO CARD
   *  ------------------------------------------------------------------ */
  async notificarPrestadorContratadoCancelamento(
    prestadorId: number,
    id_pedido: string,
    card: any,
  ) {
    try {
      const subs = await this.prisma.userSubscription.findMany({
        where: { prestadorId },
      });

      if (!subs.length) return;

      // 📌 Cria registro da notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `❌ Contrato cancelado`,
          body: `O pedido de ${card.categoria} que você estava executando foi cancelado.`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          prestadorId,
        },
      });

      const payload = JSON.stringify({
        title: '❌ Contrato cancelado',
        body: `O pedido de ${card.categoria} foi cancelado pelo cliente.`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/tudu-professional/home',
        data: {
          id_pedido: id_pedido,
          type: 'CONTRATO_CANCELADO',
          categoria: card.categoria,
        },
      });

      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          console.log(
            `✅ Notificação de cancelamento de contrato enviada para prestador ${prestadorId}`,
          );
        } catch (err) {
          console.error(
            `Erro enviando notificação de cancelamento para prestador ${prestadorId}:`,
            err,
          );
        }
      }
    } catch (err) {
      console.error('Erro notificarPrestadorContratadoCancelamento:', err);
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
      const subs = await this.prisma.userSubscription.findMany({
        where: { clienteId },
      });

      if (!subs.length) return;

      // 📌 Cria registro da notificação no banco
      await this.prisma.notification.create({
        data: {
          title: `📝 Candidatura cancelada`,
          body: `${prestador.nome} cancelou a proposta no seu pedido.`,
          icon: '/assets/icons/icon-192x192.png',
          id_pedido: id_pedido,
          clienteId,
        },
      });

      const payload = JSON.stringify({
        title: '📝 Candidatura cancelada',
        body: `${prestador.nome} cancelou a proposta no seu pedido de ${card.categoria}.`,
        icon: '/assets/icons/icon-192x192.png',
        url: this.buildNotificationUrl(id_pedido),
        data: {
          id_pedido: id_pedido,
          type: 'CANDIDATURA_CANCELADA',
          prestadorNome: `${prestador.nome}`,
        },
      });

      for (const s of subs) {
        const sub = JSON.parse(s.subscriptionJson);
        try {
          await webpush.sendNotification(sub, payload);
          console.log(
            '✅ Notificação de cancelamento de candidatura enviada para cliente',
          );
        } catch (err) {
          console.error('Erro enviando notificação de cancelamento:', err);
        }
      }
    } catch (err) {
      console.error('Erro notificarClienteCancelamentoCandidatura:', err);
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
      id_pedido: 'test-123',
      clienteId,
      prestadorId,
    });
  }

  /** ------------------------------------------------------------------
   *  ✅ MARCA NOTIFICAÇÃO COMO LIDA
   *  ------------------------------------------------------------------ */
  async markAsRead(id: number) {
    // Verifica se a notificação existe
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
    }

    // Atualiza para lida
    const updatedNotification = await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    // ✅ RETORNA COM id_pedido
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

    console.log('CountUnread - Where clause:', where);

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
   *  🔧 MÉTODO AUXILIAR: CONSTRÓI URL A PARTIR DO ID_PEDIDO
   *  ------------------------------------------------------------------ */
  private buildNotificationUrl(id_pedido: string): string {
    return `/home/budgets?id=${id_pedido}&flow=publicado`;
  }
}
