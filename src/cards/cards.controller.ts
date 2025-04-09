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
import { CreateCardDto } from './dto/create-card.dto';

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  create(@Body() newCard: CreateCardDto) {
    return this.cardsService.create(newCard); // Retorna o resultado do serviço
  }

  @Get()
  findAll() {
    return this.cardsService.findAll(); // Retorna todos os cards
  }

  // @Get(':id')
  // findOne(@Param('id') client_id: string) {
  //   return this.cardsService.findOne(client_id); // Retorna um card específico
  // }

  @Put(':id')
  update(
    @Param('id') client_id: string,
    @Body() updatedCard: Partial<CreateCardDto>,
  ) {
    return this.cardsService.update(client_id, updatedCard); // Atualiza um card
  }

  @Delete(':id')
  remove(@Param('id') client_id: string) {
    return this.cardsService.remove(client_id); // Remove um card
  }
}
