import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { EventsGateway } from 'src/events/events.gateway';
import { NotificationsService } from 'src/notifications/service/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CancelCardDto } from './dto/cancel-card.dto';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { Card } from './entities/showcase-card.entity';
@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createCardDto: CreateCardDto, imagensUrl?: string[]) {
    const generateNumericId = customAlphabet('0123456789', 8);
    const id_pedido = generateNumericId();

    // Criamos o objeto de dados explicitamente para evitar erros de tipagem do Prisma
    const novoCard = await this.prisma.card.create({
      data: {
        id_pedido: id_pedido,
        id_cliente: Number(createCardDto.id_cliente),
        categoria: createCardDto.categoria,
        subcategoria: createCardDto.subcategoria,
        status_pedido: createCardDto.status_pedido,
        filters: createCardDto.filters,
        serviceDescription: createCardDto.serviceDescription,
        valor: createCardDto.valor,
        horario_preferencial: createCardDto.horario_preferencial,
        codigo_confirmacao: createCardDto.codigo_confirmacao,
        cep: createCardDto.cep,
        street: createCardDto.street,
        neighborhood: createCardDto.neighborhood,
        city: createCardDto.city,
        state: createCardDto.state,
        number: createCardDto.number,
        complement: createCardDto.complement || null,
        imagens:
          imagensUrl?.length > 0
            ? {
                create: imagensUrl.map((url, index) => ({
                  url,
                  nome: `Imagem ${index + 1}`,
                })),
              }
            : undefined,
      },
      include: { imagens: true },
    });

    // Notificação em background (não trava a resposta)
    this.notificationsService
      .sendCardCreatedPushOptimized(novoCard)
      .catch((err) => this.logger.error(`Erro push: ${err.message}`));

    return novoCard;
  }

  async findAll(
    prestadorInfo: {
      id_prestador?: string;
      cpf?: string;
      email?: string;
      telefone?: string;
      id_cliente?: number;
    } | null,
    clienteInfo: { id_cliente?: number } | null,
    status_pedido?: string,
    offset: number = 0,
    limit: number = 10,
    valorMin?: number | string,
    valorMax?: number | string,
    dataInicial?: string,
    dataFinal?: string,
    categoria?: string,
    filters?: string,
  ): Promise<{
    cards: any[];
    counts: {
      publicado: number;
      andamento: number;
      finalizado: number;
      cancelado: number;
      pendente: number;
    };
  }> {
    const { telefone, cpf, email, id_prestador } = prestadorInfo || {};
    const { id_cliente } = clienteInfo || {};

    const whereClause: any = {};

    // Se é um CLIENTE, mostrar apenas seus próprios cards
    if (id_cliente) {
      whereClause.id_cliente = id_cliente;
    }
    // Se é um PRESTADOR, mostrar cards de outros clientes
    else if (id_prestador) {
      // ✅ APENAS aplicar filtros NOT para status 'publicado'
      const aplicarFiltrosNot = status_pedido === 'publicado';

      if (aplicarFiltrosNot) {
        const filters = [];
        let clienteIdParaExcluir: number | null = null;

        if (cpf && cpf.trim() !== '') filters.push({ cpf: cpf.trim() });
        if (email && email.trim() !== '') filters.push({ email: email.trim() });
        if (telefone && telefone.trim() !== '')
          filters.push({ telefone: telefone.trim() });

        if (filters.length > 0) {
          const clienteComMesmosDados = await this.prisma.cliente.findFirst({
            where: {
              OR: filters,
            },
            select: { id_cliente: true },
          });

          if (clienteComMesmosDados) {
            clienteIdParaExcluir = clienteComMesmosDados.id_cliente;
          }
        }

        const notConditions: any[] = [];

        // Excluir cards onde o prestador já se candidatou (apenas para publicado)
        notConditions.push({
          Candidatura: {
            some: {
              prestador_id: Number(id_prestador),
              status: {
                notIn: ['negociacao', 'recusado'],
              },
            },
          },
        });

        if (clienteIdParaExcluir !== null) {
          notConditions.push({
            id_cliente: clienteIdParaExcluir,
          });
        }

        if (notConditions.length > 0) {
          whereClause.NOT = notConditions;
        }
      }
    }

    // Filtro por valor mínimo e máximo
    if (valorMin !== undefined || valorMax !== undefined) {
      whereClause.valor = {};

      if (valorMin !== undefined) {
        whereClause.valor.gte =
          typeof valorMin === 'string' ? parseFloat(valorMin) : valorMin;
      }

      if (valorMax !== undefined) {
        whereClause.valor.lte =
          typeof valorMax === 'string' ? parseFloat(valorMax) : valorMax;
      }
    }

    if (dataInicial) {
      whereClause.horario_preferencial = {
        ...whereClause.horario_preferencial,
        gte: `${dataInicial} 00:00`,
      };
    }

    if (dataFinal) {
      whereClause.horario_preferencial = {
        ...whereClause.horario_preferencial,
        lte: `${dataFinal} 23:59`,
      };
    }

    if (categoria) {
      whereClause.categoria = categoria;
    }

    const prestadorId = Number(id_prestador);

    const allCards = await this.prisma.card.findMany({
      where: whereClause,
      include: {
        Candidatura: true,
        imagens: true,
        pagamentos: {
          orderBy: { created_at: 'desc' }, // Pega o mais recente primeiro
          take: 1, // Pega apenas o último pagamento
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const counts = {
      publicado: allCards.filter((card) => {
        return (
          card.status_pedido === 'publicado' &&
          !card.Candidatura.some((c) => c.prestador_id === prestadorId)
        );
      }).length,

      andamento: allCards.filter((card) => {
        const emNegociacao = card.Candidatura.some(
          (c) => c.status === 'negociacao' && c.prestador_id === prestadorId,
        );

        const publicadoComCandidatura =
          card.status_pedido === 'publicado' &&
          card.Candidatura.some((c) => c.prestador_id === prestadorId);

        return emNegociacao || publicadoComCandidatura;
      }).length,

      finalizado: allCards.filter((card) => {
        if (card.status_pedido !== 'finalizado') return false;

        if (id_cliente && card.id_cliente === id_cliente) return true;

        return card.Candidatura.some((c) => c.prestador_id === prestadorId);
      }).length,

      cancelado: allCards.filter((card) => {
        if (card.status_pedido !== 'cancelado') return false;

        if (id_cliente && card.id_cliente === id_cliente) return true;

        if (id_prestador) {
          return card.Candidatura.some((c) => c.prestador_id === prestadorId);
        }

        return false;
      }).length,

      pendente: allCards.filter((card) => {
        if (card.status_pedido !== 'pendente') return false;

        if (id_cliente && card.id_cliente === id_cliente) return true;

        return card.Candidatura.some((c) => c.prestador_id === prestadorId);
      }).length,
    };

    const cardsFiltrados = allCards.filter((card) => {
      if (status_pedido === 'publicado') {
        return (
          card.status_pedido === 'publicado' &&
          !card.Candidatura.some((c) => c.prestador_id === prestadorId)
        );
      }

      if (status_pedido === 'andamento') {
        const emNegociacao = card.Candidatura.some(
          (c) => c.status === 'negociacao' && c.prestador_id === prestadorId,
        );

        const publicadoComCandidatura =
          card.status_pedido === 'publicado' &&
          card.Candidatura.some((c) => c.prestador_id === prestadorId);

        return emNegociacao || publicadoComCandidatura;
      }

      if (status_pedido === 'finalizado') {
        return (
          card.status_pedido === 'finalizado' &&
          ((id_cliente && card.id_cliente === id_cliente) ||
            card.Candidatura.some((c) => c.prestador_id === prestadorId))
        );
      }

      if (status_pedido === 'pendente') {
        return card.status_pedido === 'pendente';
      }

      if (status_pedido === 'cancelado') {
        // ✅ AGORA SÓ TRÁS CANCELADOS
        if (card.status_pedido !== 'cancelado') return false;

        if (id_cliente && card.id_cliente === id_cliente) {
          return true;
        }
        if (id_prestador) {
          return card.Candidatura.some((c) => c.prestador_id === prestadorId);
        }
        return false;
      }

      return true;
    });

    cardsFiltrados.sort((a, b) => {
      const isAAndamento = a.status_pedido === 'andamento';
      const isBAndamento = b.status_pedido === 'andamento';

      if (isAAndamento && isBAndamento) {
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }

      if (isAAndamento && !isBAndamento) return -1;
      if (!isAAndamento && isBAndamento) return 1;

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const totalFiltrados = cardsFiltrados.length;
    const safeOffset = offset >= totalFiltrados ? 0 : offset;
    const paginatedCards = cardsFiltrados.slice(safeOffset, safeOffset + limit);

    const cardsFormatados = paginatedCards.map((card) => {
      const todasCandidaturas = card.Candidatura.map((c) => ({
        id_candidatura: c.id_candidatura || null,
        prestador_id: c.prestador_id || null,
        valor_negociado: c.valor_negociado || null,
        horario_negociado: c.horario_negociado || null,
        data_candidatura: c.data_candidatura || null,
        status: c.status || false,
      }));

      const candidaturasFiltradas =
        id_cliente !== undefined
          ? todasCandidaturas.filter((c) => c.status !== 'recusado')
          : todasCandidaturas.filter((c) => c.prestador_id === prestadorId);

      // Pega o charge_id do último pagamento (se existir)
      const ultimoPagamento = card.pagamentos[0];
      const charge_id = ultimoPagamento?.charge_id || null;
      const total_amount = ultimoPagamento?.total_amount || null;
      const paymentType = ultimoPagamento?.type || null;

      return {
        id_pedido: card.id_pedido,
        id_cliente: card.id_cliente.toString(),
        id_prestador:
          status_pedido === 'pendente' && candidaturasFiltradas.length > 0
            ? candidaturasFiltradas[0].prestador_id
            : null,
        status_pedido: card.status_pedido,
        categoria: card.categoria,
        subcategoria: card.subcategoria,
        filters: card.filters,
        serviceDescription: card.serviceDescription || null,
        valor: card.valor.toString(),
        horario_preferencial: card.horario_preferencial,
        codigo_confirmacao: card.codigo_confirmacao || null,
        data_finalizacao: card.data_finalizacao || null,
        imagens: card.imagens.map((img) => img.url),
        address: {
          cep: card.cep,
          street: card.street,
          neighborhood: card.neighborhood,
          city: card.city,
          state: card.state,
          number: card.number,
          complement: card.complement || null,
        },
        candidaturas: candidaturasFiltradas,
        chargeInfos: {
          charge_id: charge_id, // ← NOVO CAMPO ADICIONADO
          total_amount: total_amount ? (total_amount / 100).toFixed(2) : null, // Convertendo para reais
          paymentType: paymentType,
        },
        createdAt: this.adjustTimezone(card.createdAt),
        updatedAt: this.adjustTimezone(card.updatedAt),
      };
    });

    return {
      cards: cardsFormatados,
      counts,
    };
  }

  // async findById(
  //   id_pedido: string,
  //   prestadorInfo: {
  //     id_prestador?: string;
  //   } | null,
  //   clienteInfo: {
  //     id_cliente?: number;
  //   } | null,
  //   idPrestadorFromHeader,
  // ): Promise<any> {
  //   const { id_prestador } = prestadorInfo || {};
  //   const { id_cliente } = clienteInfo || {};

  //   const card = await this.prisma.card.findUnique({
  //     where: {
  //       id_pedido,
  //     },
  //     include: {
  //       Candidatura: true,
  //       imagens: true,
  //       pagamentos: {
  //         orderBy: { created_at: 'desc' }, // Pega o mais recente primeiro
  //         take: 1, // Pega apenas o último pagamento
  //       },
  //     },
  //   });

  //   if (!card) {
  //     throw new Error('Pedido não encontrado');
  //   }

  //   const todasCandidaturas = card.Candidatura.map((candidatura) => ({
  //     id_candidatura: candidatura.id_candidatura || null,
  //     prestador_id: candidatura.prestador_id || null,
  //     valor_negociado: candidatura.valor_negociado || null,
  //     horario_negociado: candidatura.horario_negociado || null,
  //     data_candidatura: candidatura.data_candidatura || null,
  //     status: candidatura.status || false,
  //   }));

  //   const candidaturasFiltradas =
  //     id_cliente !== undefined
  //       ? todasCandidaturas.filter((c: any) => c.status !== 'recusado')
  //       : todasCandidaturas.filter(
  //           (c: any) => c.prestador_id === Number(id_prestador),
  //         );

  //   // Pega o charge_id do último pagamento (se existir)
  //   const ultimoPagamento = card.pagamentos[0];
  //   const charge_id = ultimoPagamento?.charge_id || null;
  //   const total_amount = ultimoPagamento?.total_amount || null;
  //   const paymentType = ultimoPagamento?.type || null;

  //   return {
  //     id_pedido: card.id_pedido,
  //     id_cliente: card.id_cliente.toString(),
  //     id_prestador: card.id_prestador || null,
  //     status_pedido: card.status_pedido,

  //     categoria: card.categoria,
  //     subcategoria: card.subcategoria,
  //     serviceDescription: card.serviceDescription,
  //     valor: card.valor,
  //     horario_preferencial: card.horario_preferencial,
  //     codigo_confirmacao: card.codigo_confirmacao || null,
  //     data_finalizacao: card.data_finalizacao || null,

  //     imagens: card.imagens.map((img) => img.url),

  //     address: {
  //       cep: card.cep,
  //       street: card.street,
  //       neighborhood: card.neighborhood,
  //       city: card.city,
  //       state: card.state,
  //       number: card.number,
  //       complement: card.complement || null,
  //     },

  //     candidaturas: candidaturasFiltradas,
  //     chargeInfos: {
  //       charge_id: charge_id, // ← NOVO CAMPO ADICIONADO
  //       total_amount: total_amount,
  //       paymentType: paymentType,
  //     },
  //     createdAt: card.createdAt,
  //     updatedAt: card.updatedAt,
  //   };
  // }
  async findById(
    id_pedido: string,
    prestadorInfo: { id_prestador?: string } | null,
    clienteInfo: { id_cliente?: number } | null,
  ): Promise<any> {
    const prestadorId = Number(prestadorInfo?.id_prestador);
    const clienteId = clienteInfo?.id_cliente;

    const card = await this.prisma.card.findUnique({
      where: { id_pedido },
      include: {
        Candidatura: true,
        imagens: true,
        pagamentos: { orderBy: { created_at: 'desc' }, take: 1 },
      },
    });

    if (!card) throw new NotFoundException('Pedido não encontrado');

    // Filtragem eficiente no nível de memória (já que é um único card)
    const candidaturas = clienteId
      ? card.Candidatura.filter((c) => c.status !== 'recusado')
      : card.Candidatura.filter((c) => c.prestador_id === prestadorId);

    const ultimoPagamento = card.pagamentos[0];

    return {
      ...card,
      id_cliente: card.id_cliente.toString(),
      valor: card.valor.toString(),
      imagens: card.imagens.map((img) => img.url),
      address: {
        cep: card.cep,
        street: card.street,
        neighborhood: card.neighborhood,
        city: card.city,
        state: card.state,
        number: card.number,
        complement: card.complement || null,
      },
      candidaturas: candidaturas.map((c) => ({
        ...c,
        valor_negociado: c.valor_negociado?.toString(),
      })),
      chargeInfos: {
        charge_id: ultimoPagamento?.charge_id || null,
        total_amount: ultimoPagamento?.total_amount || null,
        paymentType: ultimoPagamento?.type || null,
      },
      createdAt: this.adjustTimezone(card.createdAt),
      updatedAt: this.adjustTimezone(card.updatedAt),
    };
  }
  async update(id_pedido: string, updateCardDto: UpdateCardDto) {
    // 1. Busca inicial para validações (Apenas uma vez)
    const existingCard = await this.prisma.card.findUnique({
      where: { id_pedido },
      include: { Candidatura: true },
    });

    if (!existingCard)
      throw new NotFoundException(`Card ${id_pedido} não encontrado`);

    // 2. Determina o prestador a ser salvo no card (se for pendente)
    const id_prestador_contratado =
      updateCardDto.status_pedido === 'pendente'
        ? updateCardDto.candidaturas?.[0]?.prestador_id
        : undefined;

    // 3. Atualização principal do Card
    const updatedCard = await this.prisma.card.update({
      where: { id_pedido },
      data: {
        id_prestador: id_prestador_contratado ?? existingCard.id_prestador,
        status_pedido:
          updateCardDto.status_pedido ?? existingCard.status_pedido,
        categoria: updateCardDto.categoria ?? existingCard.categoria,
        valor: updateCardDto.valor ?? existingCard.valor,
        data_finalizacao: updateCardDto.data_finalizacao,
        // ... espalhar outros campos se necessário
      },
      include: { Candidatura: true },
    });

    // 4. Processamento de Candidaturas em Lote (Performance!)
    let houveNovaCandidatura = false;
    if (updateCardDto.candidaturas?.length > 0) {
      const promises = updateCardDto.candidaturas.map(async (dto) => {
        const existing = existingCard.Candidatura.find(
          (c) => c.prestador_id === dto.prestador_id,
        );

        // Verifica se houve mudança real
        const mudou =
          !existing ||
          existing.valor_negociado !== dto.valor_negociado ||
          existing.status !== dto.status;

        if (mudou) houveNovaCandidatura = true;

        return this.prisma.candidatura.upsert({
          where: {
            id_pedido_prestador_id: {
              id_pedido,
              prestador_id: dto.prestador_id,
            },
          },
          update: {
            valor_negociado: dto.valor_negociado,
            horario_negociado: dto.horario_negociado,
            status: dto.status,
            data_candidatura: new Date(),
          },
          create: {
            id_pedido,
            prestador_id: dto.prestador_id,
            valor_negociado: dto.valor_negociado,
            status: dto.status,
          },
        });
      });

      await Promise.all(promises);
    }

    // 5. Orquestração de Notificações (Sem 'await' para retornar resposta mais rápido)
    this.handleNotifications(
      updatedCard,
      existingCard,
      updateCardDto,
      houveNovaCandidatura,
    ).catch((e) => this.logger.error('Erro ao processar notificações', e));

    return updatedCard;
  }

  private async handleNotifications(
    updatedCard: any,
    existingCard: any,
    dto: UpdateCardDto,
    houveNovaCandidatura: boolean,
  ) {
    this.eventsGateway.notificarAtualizacao(updatedCard);

    // Se finalizado
    if (dto.status_pedido === 'finalizado') {
      await this.notificationsService.notificarServicoFinalizado(
        updatedCard.id_pedido,
        updatedCard,
      );
    }

    // Se contratou (pendente)
    if (dto.status_pedido === 'pendente' && dto.candidaturas?.[0]) {
      const prestadorId = dto.candidaturas[0].prestador_id;
      const prestador = await this.prisma.prestador.findUnique({
        where: { id_prestador: prestadorId },
      });
      await Promise.all([
        this.notificationsService.notificarClienteContratacao(
          existingCard.id_cliente,
          updatedCard.id_pedido,
          prestador,
          updatedCard,
        ),
        this.notificationsService.notificarPrestadorContratacao(
          prestadorId,
          updatedCard.id_pedido,
          updatedCard,
        ),
      ]);
    }

    // Se houve nova candidatura e NÃO está pendente
    if (houveNovaCandidatura && dto.status_pedido !== 'pendente') {
      this.eventsGateway.emitirAlertaNovaCandidatura(updatedCard.id_pedido);
      // Aqui você dispararia o push individual de nova candidatura se necessário
    }
  }
  async cancel(
    id_pedido: string,
    cancelCardDto: CancelCardDto,
    userInfo: { id_cliente?: number; role?: string },
  ) {
    // Mantemos a transação para garantir que se o Card falhar, as candidaturas não sejam alteradas
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Busca rápida para validação de estado
      const card = await tx.card.findUnique({
        where: { id_pedido },
        select: {
          status_pedido: true,
          id_cliente: true,
          id_prestador: true,
          Candidatura: {
            include: { Prestador: true },
          },
        },
      });

      if (!card)
        throw new NotFoundException(`Card com ID ${id_pedido} não encontrado`);
      if (card.status_pedido === 'cancelado')
        throw new ForbiddenException('Este pedido já está cancelado');
      if (card.status_pedido === 'finalizado')
        throw new ForbiddenException(
          'Pedidos finalizados não podem ser cancelados',
        );

      // 2. Cancelar candidaturas em lote (Bulk Update)
      await tx.candidatura.updateMany({
        where: { id_pedido, status: { not: 'cancelado' } },
        data: { status: 'cancelado' },
      });

      // 3. Atualizar o Card e já trazer tudo que precisamos para a resposta e notificações
      const updatedCard = await tx.card.update({
        where: { id_pedido },
        data: {
          status_pedido: 'cancelado',
          cancellation_reason:
            cancelCardDto.cancellation_reason || 'Cancelado pelo usuário',
          updatedAt: new Date(),
        },
        include: {
          imagens: true,
          pagamentos: true,
          Candidatura: {
            include: { Prestador: true },
          },
        },
      });

      return { cardAntes: card, updatedCard };
    });

    // --- FORA DA TRANSAÇÃO (Background Processing) ---
    // Isso faz a API responder instantaneamente enquanto as notificações processam
    this.handleCancelNotifications(result.cardAntes, result.updatedCard).catch(
      (err) =>
        this.logger.error(
          `Erro ao processar notificações de cancelamento: ${err.message}`,
        ),
    );

    return {
      status: 'success',
      message: 'Pedido cancelado com sucesso',
      card: result.updatedCard,
    };
  }

  // Método auxiliar para não poluir o cancel principal
  private async handleCancelNotifications(cardAntes: any, updatedCard: any) {
    const id_pedido = updatedCard.id_pedido;

    // 1. WebSocket
    this.eventsGateway.notificarAtualizacao(updatedCard);
    this.eventsGateway.notifyClientStatusChange(id_pedido, 'cancelado');

    // 2. Notificar múltiplos prestadores (se estava publicado)
    if (
      cardAntes.status_pedido === 'publicado' &&
      cardAntes.Candidatura.length > 0
    ) {
      await this.notificationsService.notificarPrestadoresCancelamentoCard(
        cardAntes.Candidatura,
        id_pedido,
        updatedCard,
      );
    }

    // 3. Notificar prestador específico (se estava pendente/contratado)
    if (cardAntes.status_pedido === 'pendente' && cardAntes.id_prestador) {
      await this.notificationsService.notificarPrestadorContratadoCancelamento(
        cardAntes.id_prestador,
        id_pedido,
        updatedCard,
      );
    }
  }
  adjustTimezone(date: Date): Date {
    const adjustedDate = new Date(date);
    adjustedDate.setHours(adjustedDate.getHours() - 3);
    return adjustedDate;
  }

  private readonly showcaseCards: Card[] = [
    {
      id: 1,
      icon: 'fas fa-tools',
      cardDetail: {
        label: 'Reparos e Manutenção',
        value: 'reparos',
      },
      disabled: false,
    },
    {
      id: 2,
      icon: 'fas fa-broom',
      cardDetail: {
        label: 'Limpeza e Higienização',
        value: 'limpeza',
      },
      disabled: false,
    },
    {
      id: 3,
      icon: 'fas fa-hard-hat',
      cardDetail: {
        label: 'Reformas e Construção',
        value: 'construcao',
      },
      disabled: false,
    },
    {
      id: 4,
      icon: 'fas fa-cogs',
      cardDetail: {
        label: 'Montagem e Instalação',
        value: 'montagem',
      },
      disabled: false,
    },
    {
      id: 5,
      icon: 'fas fa-seedling',
      cardDetail: {
        label: 'Jardim e Piscina',
        value: 'jardim',
      },
      disabled: false,
    },
    {
      id: 6,
      icon: 'fas fa-ellipsis-h',
      cardDetail: {
        label: 'Outros serviços',
        value: 'outros',
      },
      disabled: false,
    },
  ];

  async getServiceCardsWithDisabled(
    clientId: number,
  ): Promise<{ cards: Card[]; counts: any }> {
    try {
      let activeCategories: string[] = [];
      // Agora o map guarda um array de objetos { id_pedido, status_pedido }
      let categoryPedidoMap: Record<
        string,
        { id_pedido: string; status_pedido: string }[]
      > = {};

      if (clientId !== undefined) {
        // Busca todos os cards ativos do cliente
        const activeCards = await this.prisma.card.findMany({
          where: {
            id_cliente: clientId,
            status_pedido: {
              notIn: ['finalizado', 'cancelado'],
            },
          },
          select: {
            categoria: true,
            id_pedido: true,
            status_pedido: true,
          },
        });

        activeCategories = activeCards.map((card) => card.categoria);

        // Mapeia categoria => array de { id_pedido, status_pedido }
        activeCards.forEach((card) => {
          if (!categoryPedidoMap[card.categoria]) {
            categoryPedidoMap[card.categoria] = [];
          }
          categoryPedidoMap[card.categoria].push({
            id_pedido: card.id_pedido,
            status_pedido: card.status_pedido,
          });
        });
      }

      const processedCards = this.showcaseCards.map((card) => {
        const categoriaShowcase = card.cardDetail.label;
        const isDisabled = activeCategories.includes(categoriaShowcase);
        // Retorna todos os pedidos ativos e seus status da categoria
        const pedidos_ativos = isDisabled
          ? (categoryPedidoMap[categoriaShowcase] ?? [])
          : [];
        return {
          ...card,
          disabled: isDisabled,
          pedidos_ativos, // array de { id_pedido, status_pedido }
        };
      });

      return {
        cards: processedCards,
        counts: {
          total: processedCards.length,
          disabled: activeCategories.length,
        },
      };
    } catch (error) {
      console.error('Error in getServiceCardsWithDisabled:', error);
      throw error;
    }
  }

  async getHighlightsCategorias(): Promise<{
    highlights: { categoria: string; total: number }[];
  }> {
    // Agrupa e conta os cards por categoria
    const categorias = await this.prisma.card.groupBy({
      by: ['categoria'],
      _count: { categoria: true },
      orderBy: { _count: { categoria: 'desc' } },
    });

    // Monta o array de highlights
    const highlights = categorias.map((cat) => ({
      categoria: cat.categoria,
      total: cat._count.categoria,
    }));

    return { highlights };
  }

  async cancelarCandidatura(
    id_pedido: string,
    id_candidatura: string,
    userInfo: { id_cliente?: number; role?: string },
  ) {
    const candidaturaId = Number(id_candidatura);

    // 1. Executamos as operações de banco
    const result = await this.prisma.$transaction(async (tx) => {
      // Em vez de findUnique e depois delete, tentamos deletar direto.
      // Se não existir, o Prisma lança erro, que tratamos.
      let candidatura;
      try {
        candidatura = await tx.candidatura.delete({
          where: { id_candidatura: candidaturaId },
          include: {
            Card: {
              select: {
                status_pedido: true,
                id_cliente: true,
                id_prestador: true,
              },
            },
            Prestador: {
              select: { id_prestador: true, nome: true, sobrenome: true },
            },
          },
        });
      } catch (e) {
        throw new NotFoundException(
          `Candidatura ${id_candidatura} não encontrada ou já removida.`,
        );
      }

      if (candidatura.id_pedido !== id_pedido) {
        throw new BadRequestException(
          'A candidatura não pertence a este pedido',
        );
      }

      let novoStatus = candidatura.Card.status_pedido;
      let novoPrestadorId = candidatura.Card.id_prestador;

      // Se o card estava pendente e o prestador que saiu era o contratado
      if (candidatura.Card.status_pedido === 'pendente') {
        const outrasCandidaturasAtivasCount = await tx.candidatura.count({
          where: {
            id_pedido: id_pedido,
            status: { not: 'cancelado' },
          },
        });

        if (outrasCandidaturasAtivasCount === 0) {
          novoStatus = 'publicado';
          novoPrestadorId = null;
        }
      }

      // Atualização atômica do Card
      const cardAtualizado = await tx.card.update({
        where: { id_pedido },
        data: {
          status_pedido: novoStatus,
          id_prestador: novoPrestadorId,
          updatedAt: new Date(),
        },
        include: {
          Candidatura: {
            where: { status: { not: 'cancelado' } }, // Filtro de performance para não trazer lixo
            include: { Prestador: true },
          },
        },
      });

      return { candidatura, cardAtualizado };
    });

    // 2. Processamento Assíncrono (Webhooks/Pushes) - Fora da Transação
    // Usamos process.nextTick ou simplesmente não aguardamos o resultado final para responder o cliente
    this.notificationsService
      .notificarClienteCancelamentoCandidatura(
        result.candidatura.Card.id_cliente,
        id_pedido,
        result.candidatura.Prestador,
        result.cardAtualizado,
      )
      .catch((err) => this.logger.error(`Erro notificação: ${err.message}`));

    this.eventsGateway.notificarAtualizacao(result.cardAtualizado);

    return {
      status: 'success',
      message: 'Candidatura removida com sucesso',
      candidatura: result.candidatura,
      card: result.cardAtualizado,
    };
  }
}
