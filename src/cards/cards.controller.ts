import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() newCard: CreateCardDto) {
    return this.cardsService.create(newCard); // Retorna o resultado do serviço
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: any) {
    const id_cliente = req.user.id_cliente; // Obtém o id_cliente do token JWT

    return this.cardsService.findAll(id_cliente); // Retorna todos os cards
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
