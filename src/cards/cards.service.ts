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
      id_cliente: createCardDto.id_cliente,
      id_prestador: createCardDto.id_prestador,
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
    });
    // Transformar os dados para incluir o endereço como um objeto
    return cards.map((card) => ({
      id_pedido: card.id_pedido,
      id_cliente: card.id_cliente.toString() || null,
      id_prestador: card.id_prestador.toString() || null,
      status_pedido: card.status_pedido,

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
      id_cliente: card.id_cliente.toString() || null,
      id_prestador: card.id_prestador?.toString() || null,
      status_pedido: card.status_pedido,

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

  async update(id_pedido: string, updateCardDto: Partial<UpdateCardDto>) {
    // Verifica se o card existe
    const existingCard = await this.prisma.card.findUnique({
      where: { id_pedido },
    });

    if (!existingCard) {
      throw new NotFoundException(`Card with ID ${id_pedido} not found`);
    }

    // Atualiza o card
    // return this.prisma.card.update({
    //   where: { id_pedido },
    //   data: {
    //     ...updateCardDto,
    //     id_cliente: updateCardDto.id_cliente
    //       ? parseInt(updateCardDto.id_cliente)
    //       : undefined,
    //     id_prestador: updateCardDto.id_prestador
    //       ? parseInt(updateCardDto.id_prestador)
    //       : undefined,
    //   },
    // });
    return this.prisma.card.update({
      where: { id_pedido },
      data: {
        ...updateCardDto,
        id_cliente: updateCardDto.id_cliente
          ? parseInt(updateCardDto.id_cliente)
          : undefined,
        id_prestador: updateCardDto.id_prestador
          ? parseInt(updateCardDto.id_prestador)
          : undefined,
      },
    });
  }

  // Remove um card específico pelo ID
  remove(id_cliente: string): void {
    const cardIndex = this.cards.findIndex((c) => c.id_cliente === id_cliente);
    if (cardIndex === -1) {
      throw new NotFoundException(`Card with ID ${id_cliente} not found`);
    }
    this.cards.splice(cardIndex, 1);
  }
}
