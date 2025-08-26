import {
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
@Injectable()
export class CardsService {
  private cards: card[] = []; // Simulação de banco de dados em memória

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
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
  ): Promise<{
    cards: any[];
    counts: { publicado: number; andamento: number; finalizado: number };
  }> {
    const { telefone, cpf, email, id_prestador } = prestadorInfo || {};
    const { id_cliente } = clienteInfo || {};

    const filters = [];
    if (telefone) filters.push({ telefone });
    if (cpf) filters.push({ cpf });
    if (email) filters.push({ email });

    const whereClause: any = id_cliente
      ? { id_cliente }
      : {
          NOT: {
            Cliente: {
              OR: filters,
            },
          },
        };

    // CORREÇÃO: Filtro por valor mínimo e máximo
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
      },
      orderBy: {
        updatedAt: 'desc', // Alterado para usar updatedAt como ordenação primária
      },
    });

    const counts = {
      publicado: allCards.filter(
        (card) =>
          card.status_pedido === 'publicado' &&
          !card.Candidatura.some((c) => c.prestador_id === prestadorId),
      ).length,

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

    // 🛠 Correção: previne slice inválido
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
        ? todasCandidaturas.filter((c: any) => c.status !== 'recusado') // cliente não vê recusadas
        : todasCandidaturas.filter(
            // prestador vê apenas sua candidatura, inclusive se for recusada
            (c: any) => c.prestador_id === Number(id_prestador),
          );

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
    const { id_cliente, role } = userInfo;

    // Buscar o card
    const card = await this.prisma.card.findUnique({
      where: { id_pedido },
      include: { Candidatura: true },
    });

    if (!card) {
      throw new NotFoundException(`Card com ID ${id_pedido} não encontrado`);
    }

    // Verificar permissões
    const isOwner = card.id_cliente === id_cliente;
    // const isAdmin = role === 'admin';

    if (!isOwner) {
      throw new ForbiddenException(
        'Você não tem permissão para cancelar este pedido',
      );
    }

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

    // Realizar o cancelamento lógico
    const updatedCard = await this.prisma.card.update({
      where: { id_pedido },
      data: {
        status_pedido: 'cancelado',
        cancellation_reason:
          cancelCardDto.cancellation_reason || 'Cancelado pelo usuário',
        updatedAt: new Date(),
      },
      include: {
        Candidatura: true,
        imagens: true,
      },
    });

    // Notificar via WebSocket
    await this.eventsGateway.notificarAtualizacao(updatedCard);
    this.eventsGateway.notifyClientStatusChange(
      updatedCard.id_pedido,
      updatedCard.status_pedido,
    );

    return {
      status: 'success',
      message: 'Pedido cancelado com sucesso',
      card: updatedCard,
    };
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

      // 1. Buscar apenas categorias ativas (não finalizadas nem canceladas)
      if (clientId !== undefined) {
        const activeCards = await this.prisma.card.findMany({
          where: {
            id_cliente: clientId,
            status_pedido: {
              notIn: ['finalizado', 'cancelado'], // ← FILTRO OTIMIZADO
            },
          },
          select: {
            categoria: true,
          },
          distinct: ['categoria'], // ← EVITA DUPLICATAS
        });

        activeCategories = activeCards.map((card) => card.categoria);
      }

      // 2. Processar os cards do showcase
      const processedCards = this.showcaseCards.map((card) => {
        const isDisabled = activeCategories.includes(card.cardDetail.label);
        return {
          ...card,
          disabled: isDisabled,
        };
      });

      return {
        cards: clientId !== undefined ? processedCards : this.showcaseCards,
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
}
