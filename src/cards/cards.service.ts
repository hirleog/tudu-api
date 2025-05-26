import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { card } from './entities/card.entity';
import { UpdateCardDto } from './dto/update-card.dto';
import { customAlphabet } from 'nanoid';
import { EventsGateway } from 'src/events/events.gateway';
@Injectable()
export class CardsService {
  private cards: card[] = []; // Simulação de banco de dados em memória

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(createCardDto: CreateCardDto) {
    const generateNumericId = customAlphabet('0123456789', 8);
    const id_pedido = generateNumericId(); // exemplo: '492173'

    const createInput: any = {
      id_pedido: id_pedido, // gera algo como "5gD1kqR7vB"
      id_cliente: Number(createCardDto.id_cliente),
      status_pedido: createCardDto.status_pedido,
      categoria: createCardDto.categoria,
      subcategoria: createCardDto.subcategoria,
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

    return this.prisma.card.create({
      data: createInput,
    });
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

    const prestadorId = Number(id_prestador);

    const allCards = await this.prisma.card.findMany({
      where: whereClause,
      include: {
        Candidatura: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // ✅ Aqui o count sempre considera todos os cards
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

    // 🎯 Aplica filtro de exibição por status apenas aqui
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
          // Cliente: deve ver seus próprios cards finalizados
          ((id_cliente && card.id_cliente === id_cliente) ||
            // Prestador: deve ver os que ele participou
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

      if (isAAndamento && !isBAndamento) {
        return -1;
      }

      if (!isAAndamento && isBAndamento) {
        return 1;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const cardsFormatados = cardsFiltrados.map((card) => {
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
          ? todasCandidaturas.filter((c) => c.status !== 'recusado') // 👈 aqui o filtro extra
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
        valor: card.valor,
        horario_preferencial: card.horario_preferencial,
        codigo_confirmacao: card.codigo_confirmacao || null,

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
      valor: card.valor,
      horario_preferencial: card.horario_preferencial,
      codigo_confirmacao: card.codigo_confirmacao || null,

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
}
