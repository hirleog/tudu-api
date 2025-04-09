import { Injectable } from '@nestjs/common';
import { Card } from './entities/card.entity';

@Injectable()
export class CardsService {
  private cards: Card[] = [];

  create(createCardDto: Card): Card {
    const newCard = {
      id: Math.random().toString(36).substring(2, 9),
      ...createCardDto,
    };
    this.cards.push(newCard);
    return newCard;
  }

  findAll(): Card[] {
    return this.cards;
  }

  findOne(id: string): Card {
    return this.cards.find((card) => card.id === id);
  }

  update(id: string, updateCardDto: Card): Card {
    const cardIndex = this.cards.findIndex((card) => card.id === id);
    if (cardIndex >= 0) {
      this.cards[cardIndex] = { ...this.cards[cardIndex], ...updateCardDto };
      return this.cards[cardIndex];
    }
    return null;
  }

  remove(id: string): boolean {
    const cardIndex = this.cards.findIndex((card) => card.id === id);
    if (cardIndex >= 0) {
      this.cards.splice(cardIndex, 1);
      return true;
    }
    return false;
  }
}
