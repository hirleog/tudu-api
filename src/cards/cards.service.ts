import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { card } from './entities/card.entity';
import { UpdateCardDto } from './dto/update-card.dto';

@Injectable()
export class CardsService {
  private cards: card[] = []; // Simulação de banco de dados em memória

  constructor(private readonly prisma: PrismaService) {}

  async create(createCardDto: CreateCardDto) {
    const createInput: any = {
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

  // async findAll(prestadorInfo: { telefone?: string } | null): Promise<card[]> {
  //   const { telefone } = prestadorInfo || {};

  //   console.log('Prestador Info:', prestadorInfo); // Log para verificar o prestadorInfo

  //   const cards = await this.prisma.card.findMany({
  //     where: prestadorInfo && telefone
  //       ? {
  //           Cliente: {
  //             telefone: {
  //               not: telefone, // Exclui os cards cujo telefone do cliente seja igual ao do prestador
  //             },
  //           },
  //         }
  //       : {}, // Se for cliente ou não houver telefone, não aplica filtros
  //     include: {
  //       Candidatura: true, // Inclui as informações da tabela Candidatura
  //     },
  //   });

  async findAll(
    prestadorInfo: {
      id_prestador?: string;
      cpf?: string;
      email?: string;
      telefone?: string;
      id_cliente?: number;
    } | null,
    clienteInfo: { id_cliente?: number } | null,
    status_pedido?: string, // novo parâmetro
  ): Promise<card[]> {
    const { telefone, cpf, email } = prestadorInfo || {};
    const { id_cliente } = clienteInfo || {};

    const filters = [];

    if (telefone) filters.push({ telefone });
    if (cpf) filters.push({ cpf });
    if (email) filters.push({ email });

    const whereClause: any = id_cliente
      ? {
          id_cliente,
        }
      : {
          NOT: {
            Cliente: {
              OR: filters,
            },
          },
        };

    // Se o status_pedido for informado, adiciona na cláusula where
    if (status_pedido) {
      whereClause.status_pedido = status_pedido;
    }

    const cards = await this.prisma.card.findMany({
      where: whereClause,
      include: {
        Candidatura: true,
      },
    });

    return cards.map((card) => {
      const todasCandidaturas = card.Candidatura.map((candidatura) => ({
        id_candidatura: candidatura.id_candidatura || null,
        prestador_id: candidatura.prestador_id || null,
        valor_negociado: candidatura.valor_negociado || null,
        horario_negociado: candidatura.horario_negociado || null,
        data_candidatura: candidatura.data_candidatura || null,
        status: candidatura.status || false,
      }));

      // Se o acesso for de cliente, retorna todas
      // Se o acesso for de prestador, retorna apenas a dele
      const candidaturasFiltradas =
        id_cliente !== undefined
          ? todasCandidaturas
          : todasCandidaturas.filter(
              (c) => c.prestador_id === Number(prestadorInfo?.id_prestador),
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
    });
  }

  async findById(id_pedido: string): Promise<card> {
    const card = await this.prisma.card.findUnique({
      where: {
        id_pedido, // Filtra pelo id_pedido
      },
    });

    if (!card) {
      throw new NotFoundException(`Card with ID ${id_pedido} not found`);
    }

    // Transformar os dados para incluir o endereço como um objeto
    return {
      id_pedido: card.id_pedido,
      id_cliente: card.id_cliente.toString(),
      id_prestador: card.id_prestador?.toString() || null,
      status_pedido: card.status_pedido,

      // valor_negociado: card.valor_negociado || null,
      // horario_negociado: card.horario_negociado || null,
      // data_candidatura: card.data_candidatura || null,
      // status: card.status || false,
      // codigo_confirmacao: card.codigo_confirmacao || null,
      // data_finalizacao: card.data_finalizacao || null,

      categoria: card.categoria,
      subcategoria: card.subcategoria,
      valor: card.valor,
      horario_preferencial: card.horario_preferencial,

      address: {
        cep: card.cep,
        street: card.street,
        neighborhood: card.neighborhood,
        city: card.city,
        state: card.state,
        number: card.number,
        complement: card.complement || null,
      },
    };
  }

  async update(id_pedido: string, updateCardDto: UpdateCardDto) {
    // Verifica se o card existe
    const existingCard = await this.prisma.card.findUnique({
      where: { id_pedido },
      include: { Candidatura: true }, // Inclui as candidaturas existentes
    });

    if (!existingCard) {
      throw new NotFoundException(`Card with ID ${id_pedido} not found`);
    }

    // Atualiza o status do card
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

    // Atualiza ou cria novas candidaturas
    if (updateCardDto.candidaturas) {
      const candidaturaDtos = updateCardDto.candidaturas;

      for (const candidaturaDto of candidaturaDtos) {
        // Verifica se a candidatura já existe
        const existingCandidatura = await this.prisma.candidatura.findUnique({
          where: {
            id_pedido_prestador_id: {
              id_pedido: id_pedido,
              prestador_id: candidaturaDto.prestador_id,
            },
          },
        });

        if (existingCandidatura) {
          // Atualiza a candidatura existente
          await this.prisma.candidatura.update({
            where: { id_candidatura: existingCandidatura.id_candidatura },
            data: {
              valor_negociado: candidaturaDto.valor_negociado,
              horario_negociado: candidaturaDto.horario_negociado,
              status: candidaturaDto.status,
              data_candidatura: new Date(), // Se necessário atualizar
            },
          });
        } else {
          // Caso não exista, cria uma nova candidatura
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
        }
      }
    }

    // Retorna o card atualizado, incluindo as candidaturas
    return this.prisma.card.findUnique({
      where: { id_pedido },
      include: { Candidatura: true },
    });
  }
}
