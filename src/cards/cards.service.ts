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

  async findAll(id_cliente: string): Promise<card[]> {
    const cards = await this.prisma.card.findMany({
      where: {
        id_cliente: parseInt(id_cliente), // Filtra os cards pelo id_cliente
      },
      include: {
        Candidatura: true, // Inclui as informações da tabela Candidatura
      },
    });
    // Transformar os dados para incluir o endereço como um objeto
    return cards.map((card) => ({
      id_pedido: card.id_pedido,
      id_cliente: card.id_cliente.toString(),
      id_prestador: card.id_prestador || null,
      status_pedido: card.status_pedido,

      categoria: card.categoria,
      subcategoria: card.subcategoria,
      valor: card.valor,
      horario_preferencial: card.horario_preferencial,
      codigo_confirmacao: card.codigo_confirmacao || null,

      // valor_negociado: card.valor_negociado || null,
      // horario_negociado: card.horario_negociado || null,
      // data_candidatura: card.data_candidatura || null,
      // status: card.status || false,
      // data_finalizacao: card.data_finalizacao || null,

      candidaturas: card.Candidatura.map((candidatura) => ({
        id_candidatura: 0,
        // prestador_id: candidatura.prestador_id,
        valor_negociado: candidatura.valor_negociado || '',
        horario_negociado: candidatura.horario_negociado || null,
        data_candidatura: candidatura.data_candidatura,
        status: candidatura.status || false,
      })),

      address: {
        cep: card.cep,
        street: card.street,
        neighborhood: card.neighborhood,
        city: card.city,
        state: card.state,
        number: card.number,
        complement: card.complement || null,
      },
    }));
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
    // const updatedCard = await this.prisma.card.update({
    //   where: { id_pedido },
    //   data: {
    //     status_pedido:
    //       updateCardDto.status_pedido ?? existingCard.status_pedido,
    //   },
    //   include: { Candidatura: true },
    // });

    // Adiciona uma nova candidatura se fornecida no DTO
    if (updateCardDto.candidaturas) {
      const candidaturaDtos = updateCardDto.candidaturas;

      for (const candidaturaDto of candidaturaDtos) {
        // const payload = {
        //   prestador_id: candidaturaDto.prestador_id,
        //   valor_negociado: candidaturaDto.valor_negociado,

        //   horario_negociado: candidaturaDto.horario_negociado,
        //   status: candidaturaDto.status,
        //   data_candidatura: new Date(), // Data atual
        // };
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
              // connect: { id: candidaturaDto.prestador_id }, // Ensure `prestador_id` is provided in `candidaturaDto`
            },
          },
        });
      }
    }
    return this.prisma.card.findUnique({
      where: { id_pedido },
      include: { Candidatura: true },
    });
  }
}
