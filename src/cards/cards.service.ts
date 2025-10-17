import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { card } from './entities/card.entity';
import { UpdateCardDto } from './dto/update-card.dto';
import { customAlphabet } from 'nanoid';
import { EventsGateway } from 'src/events/events.gateway';
import { Card } from './entities/showcase-card.entity';
import { CancelCardDto } from './dto/cancel-card.dto';
import { PaymentsService } from 'src/getnet/payments/payments.service';
@Injectable()
export class CardsService {
  private cards: card[] = []; // Simulação de banco de dados em memória

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly paymentsService: PaymentsService,
  ) {}

  async create(createCardDto: CreateCardDto, imagensUrl?: string[]) {
    const generateNumericId = customAlphabet('0123456789', 8);
    const id_pedido = generateNumericId();

    const cardData: any = {
      id_pedido: id_pedido,
      id_cliente: Number(createCardDto.id_cliente),
      categoria: createCardDto.categoria,
      status_pedido: createCardDto.status_pedido,
      subcategoria: createCardDto.subcategoria,
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
    };

    if (imagensUrl && imagensUrl.length > 0) {
      cardData.imagens = {
        create: imagensUrl.map((url, index) => ({
          url,
          nome: `Imagem ${index + 1}`, // obrigatório, colocar algo aqui
        })),
      };
    }

    const novoCard = await this.prisma.card.create({
      data: cardData,
      include: { imagens: true },
    });

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

  async findById(
    id_pedido: string,
    prestadorInfo: {
      id_prestador?: string;
    } | null,
    clienteInfo: {
      id_cliente?: number;
    } | null,
    idPrestadorFromHeader,
  ): Promise<any> {
    const { id_prestador } = prestadorInfo || {};
    const { id_cliente } = clienteInfo || {};

    const card = await this.prisma.card.findUnique({
      where: {
        id_pedido,
      },
      include: {
        Candidatura: true,
        imagens: true,
        pagamentos: {
          orderBy: { created_at: 'desc' }, // Pega o mais recente primeiro
          take: 1, // Pega apenas o último pagamento
        },
      },
    });

    if (!card) {
      throw new Error('Pedido não encontrado');
    }

    const todasCandidaturas = card.Candidatura.map((candidatura) => ({
      id_candidatura: candidatura.id_candidatura || null,
      prestador_id: candidatura.prestador_id || null,
      valor_negociado: candidatura.valor_negociado || null,
      horario_negociado: candidatura.horario_negociado || null,
      data_candidatura: candidatura.data_candidatura || null,
      status: candidatura.status || false,
    }));

    const candidaturasFiltradas =
      id_cliente !== undefined
        ? todasCandidaturas.filter((c: any) => c.status !== 'recusado')
        : todasCandidaturas.filter(
            (c: any) => c.prestador_id === Number(id_prestador),
          );

    // Pega o charge_id do último pagamento (se existir)
    const ultimoPagamento = card.pagamentos[0];
    const charge_id = ultimoPagamento?.charge_id || null;
    const total_amount = ultimoPagamento?.total_amount || null;

    return {
      id_pedido: card.id_pedido,
      id_cliente: card.id_cliente.toString(),
      id_prestador: card.id_prestador || null,
      status_pedido: card.status_pedido,

      categoria: card.categoria,
      subcategoria: card.subcategoria,
      serviceDescription: card.serviceDescription,
      valor: card.valor,
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
      },
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  }

  async update(id_pedido: string, updateCardDto: UpdateCardDto) {
    const existingCard = await this.prisma.card.findUnique({
      where: { id_pedido },
      include: { Candidatura: true },
    });

    if (!existingCard) {
      throw new NotFoundException(`Card with ID ${id_pedido} not found`);
    }

    const updatedCard = await this.prisma.card.update({
      where: { id_pedido },
      data: {
        status_pedido:
          updateCardDto.status_pedido ?? existingCard.status_pedido,
        categoria: updateCardDto.categoria ?? existingCard.categoria,
        subcategoria: updateCardDto.subcategoria ?? existingCard.subcategoria,
        valor: updateCardDto.valor ?? existingCard.valor,
        horario_preferencial:
          updateCardDto.horario_preferencial ??
          existingCard.horario_preferencial,
        codigo_confirmacao:
          updateCardDto.codigo_confirmacao ?? existingCard.codigo_confirmacao,
        data_finalizacao: updateCardDto.data_finalizacao ?? null, // Não atualiza se não for fornecido
        cep: updateCardDto.cep ?? existingCard.cep,
        street: updateCardDto.street ?? existingCard.street,
        neighborhood: updateCardDto.neighborhood ?? existingCard.neighborhood,
        city: updateCardDto.city ?? existingCard.city,
        state: updateCardDto.state ?? existingCard.state,
        number: updateCardDto.number ?? existingCard.number,
        complement: updateCardDto.complement ?? existingCard.complement,
      },
      include: { Candidatura: true },
    });

    await this.eventsGateway.notificarAtualizacao(updatedCard);

    if (
      updateCardDto.status_pedido &&
      updateCardDto.status_pedido === 'finalizado'
    ) {
      this.eventsGateway.notifyClientStatusChange(
        updatedCard.id_pedido,
        updatedCard.status_pedido,
      );
    }

    // Novo controle: flag para saber se houve nova candidatura
    let houveNovaCandidatura = false;

    if (updateCardDto.candidaturas) {
      const candidaturaDtos = updateCardDto.candidaturas;

      for (const candidaturaDto of candidaturaDtos) {
        const existingCandidatura = await this.prisma.candidatura.findUnique({
          where: {
            id_pedido_prestador_id: {
              id_pedido: id_pedido,
              prestador_id: candidaturaDto.prestador_id,
            },
          },
        });

        if (existingCandidatura) {
          await this.prisma.candidatura.update({
            where: { id_candidatura: existingCandidatura.id_candidatura },
            data: {
              valor_negociado: candidaturaDto.valor_negociado,
              horario_negociado: candidaturaDto.horario_negociado,
              status: candidaturaDto.status,
              data_candidatura: new Date(),
            },
          });
        } else {
          await this.prisma.candidatura.create({
            data: {
              valor_negociado: candidaturaDto.valor_negociado,
              horario_negociado: candidaturaDto.horario_negociado,
              status: candidaturaDto.status,
              data_candidatura: new Date(),
              Card: {
                connect: { id_pedido: id_pedido },
              },
              Prestador: {
                connect: { id_prestador: candidaturaDto.prestador_id },
              },
            },
          });

          // Marca que houve ao menos uma nova candidatura
          houveNovaCandidatura = true;
        }
      }
      // ✅ Emite evento apenas uma vez se ao menos uma nova candidatura foi criada
      if (houveNovaCandidatura) {
        this.eventsGateway.emitirAlertaNovaCandidatura(id_pedido);
        console.log('houveNovaCandidatura', houveNovaCandidatura);
      } else {
        console.log('Nenhuma nova candidatura foi criada');
      }
    }

    return this.prisma.card.findUnique({
      where: { id_pedido },
      include: { Candidatura: true },
    });
  }

  async cancel(
    id_pedido: string,
    cancelCardDto: CancelCardDto,
    userInfo: { id_cliente?: number; role?: string },
  ) {
    return await this.prisma.$transaction(async (prisma) => {
      const { id_cliente, role } = userInfo;

      // Buscar o card dentro da transação
      const card = await prisma.card.findUnique({
        where: { id_pedido },
        include: {
          Candidatura: true,
          pagamentos: {
            where: {
              status: 'APPROVED',
              id_pedido: id_pedido,
            },
          },
        },
      });

      if (!card) {
        throw new NotFoundException(`Card com ID ${id_pedido} não encontrado`);
      }

      // Verificar permissões
      // const isOwner = card.id_cliente === id_cliente;

      // if (!isOwner) {
      //   throw new ForbiddenException(
      //     'Você não tem permissão para cancelar este pedido',
      //   );
      // }

      // Verificar se já está cancelado
      if (card.status_pedido === 'cancelado') {
        throw new ForbiddenException('Este pedido já está cancelado');
      }

      // Verificar se pode ser cancelado (não finalizado)
      if (card.status_pedido === 'finalizado') {
        throw new ForbiddenException(
          'Pedidos finalizados não podem ser cancelados',
        );
      }

      // ✅ 2. Cancelar todas as candidaturas relacionadas ao card
      await prisma.candidatura.updateMany({
        where: {
          id_pedido: id_pedido,
          status: {
            not: 'cancelado', // Opcional: atualizar apenas as que não estão canceladas
          },
        },
        data: {
          status: 'cancelado',
        },
      });

      // ✅ 3. Cancelar o card
      const updatedCard = await prisma.card.update({
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
          Candidatura: true, // Incluir as candidaturas atualizadas na resposta
        },
      });

      // ✅ 4. Notificações
      try {
        await this.eventsGateway.notificarAtualizacao(updatedCard);
        this.eventsGateway.notifyClientStatusChange(
          updatedCard.id_pedido,
          updatedCard.status_pedido,
        );
      } catch (notificationError) {
        console.warn(
          'Erro na notificação WebSocket:',
          notificationError.message,
        );
      }

      return {
        status: 'success',
        message: 'Pedido cancelado com sucesso',
        card: updatedCard,
      };
    });
  }
  adjustTimezone(date: Date): Date {
    const adjustedDate = new Date(date);
    // Ajuste de -3 horas para UTC-3 (Brasília)
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
    return await this.prisma.$transaction(async (prisma) => {
      const { id_cliente, role } = userInfo;

      // Buscar a candidatura e o card relacionado
      const candidatura = await prisma.candidatura.findUnique({
        where: { id_candidatura: Number(id_candidatura) },
        include: {
          Card: true,
          Prestador: true,
        },
      });

      if (!candidatura) {
        throw new NotFoundException(
          `Candidatura com ID ${id_candidatura} não encontrada`,
        );
      }

      // Verificar se a candidatura pertence ao card especificado
      if (candidatura.id_pedido !== id_pedido) {
        throw new BadRequestException(
          'A candidatura não pertence a este pedido',
        );
      }

      // Verificar se a candidatura já está cancelada
      if (candidatura.status === 'cancelado') {
        throw new ForbiddenException('Esta candidatura já está cancelada');
      }

      // Atualizar o status da candidatura para cancelado
      const candidaturaDeletada = await prisma.candidatura.delete({
        where: { id_candidatura: Number(id_candidatura) },
        include: {
          Card: true,
          Prestador: true,
        },
      });

      // disponibiliza o card novamente apos remoção da candidatura
      await prisma.card.update({
        where: { id_pedido },
        data: {
          status_pedido: 'publicado',
          updatedAt: new Date(),
        },
      });
      // Notificar via WebSocket sobre a atualização
      // try {
      //   await this.eventsGateway.notificarAtualizacao(candidatura.Card);

      //   // Notificar o prestador sobre o cancelamento da sua candidatura
      //   this.eventsGateway.notifyPrestadorCandidaturaCancelada(
      //     candidatura.prestador_id,
      //     id_pedido,
      //     id_candidatura,
      //   );
      // } catch (notificationError) {
      //   console.warn(
      //     'Erro na notificação WebSocket:',
      //     notificationError.message,
      //   );
      // }
      return {
        status: 'success',
        message: 'Candidatura removida com sucesso',
        candidatura: candidaturaDeletada,
      };
    });
  }
}
