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
import { UpdateCardDto } from './dto/update-card.dto';

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() newCard: CreateCardDto, candidato: UpdateCardDto) {
    return this.cardsService.create(newCard); // Retorna o resultado do serviço
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: any) {
    const id_cliente = req.user.id_cliente; // Obtém o id_cliente do token JWT

    return this.cardsService.findAll(id_cliente); // Retorna todos os cards
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id_pedido')
  async findById(@Param('id_pedido') id_pedido: string) {
    return this.cardsService.findById(id_pedido);
  }

  @Put(':id_pedido')
  update(
    @Param('id_pedido') id_pedido: string,
    @Body() updatedCard: UpdateCardDto,
    @Req() req: any, // Injetando o contexto da requisição
  ) {
    // const id_prestador = req.user?.id_prestador;
    // // Adicionando um log para verificar o valor de id_prestador
    // console.log('ID Prestador extraído do token JWT:', id_prestador);

    // if (!id_prestador) {
    //   throw new Error('id_prestador não encontrado no token JWT');
    // }

    return this.cardsService.update(id_pedido, updatedCard); // Atualiza um card
  }

  // @Delete(':id')
  // remove(@Param('id') client_id: string) {
  //   return this.cardsService.remove(client_id); // Remove um card
  // }
}
