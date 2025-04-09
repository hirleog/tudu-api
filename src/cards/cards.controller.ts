import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CardsService } from './cards.service';
import { Card } from './entities/card.entity';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  create(@Body() createCardDto: CreateCardDto): Card {
    return this.cardsService.create(createCardDto as Card);
  }

  @Get()
  findAll(): Card[] {
    return this.cardsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Card {
    return this.cardsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateCardDto: UpdateCardDto): Card {
    return this.cardsService.update(id, updateCardDto as Card);
  }

  @Delete(':id')
  remove(@Param('id') id: string): { success: boolean } {
    return { success: this.cardsService.remove(id) };
  }
}
