import { Injectable, NotFoundException } from '@nestjs/common';
import { card } from './entities/card.entity';
import { CreateCardDto } from './dto/create-card.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CardsService {
  private cards: card[] = []; // Simulação de banco de dados em memória

  constructor(private readonly prisma: PrismaService) {}

  async create(createCardDto: CreateCardDto) {
    const createInput: any = {
      categoria: createCardDto.categoria,
      subcategoria: createCardDto.subcategoria,
      valor: createCardDto.valor,
      horario_preferencial: createCardDto.horario_preferencial,
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
      // include: { address: true },
    });
  }

  // Retorna todos os cards
  findAll() {
    return this.prisma.card.findMany(); 
  }

  // Retorna um card específico pelo ID
  findOne(client_id: string): card {
    const card = this.cards.find((c) => c.client_id === client_id);
    if (!card) {
      throw new NotFoundException(`Card with ID ${client_id} not found`);
    }
    return card;
  }

  // Atualiza um card específico pelo ID
  update(client_id: string, updatedCard: Partial<card>): card {
    const cardIndex = this.cards.findIndex((c) => c.client_id === client_id);
    if (cardIndex === -1) {
      throw new NotFoundException(`Card with ID ${client_id} not found`);
    }
    const existingCard = this.cards[cardIndex];
    const updated = { ...existingCard, ...updatedCard };
    this.cards[cardIndex] = updated;
    return updated;
  }

  // Remove um card específico pelo ID
  remove(client_id: string): void {
    const cardIndex = this.cards.findIndex((c) => c.client_id === client_id);
    if (cardIndex === -1) {
      throw new NotFoundException(`Card with ID ${client_id} not found`);
    }
    this.cards.splice(cardIndex, 1);
  }
}
