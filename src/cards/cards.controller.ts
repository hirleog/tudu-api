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
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthGuard } from '@nestjs/passport';
import { MultiRoleAuthGuard } from 'src/auth/guards/multi-role-auth.guard';
import { JwtClienteStrategy } from 'src/auth/jwt.strategy/jwt.strategy';

@Controller('cards')
export class CardsController {
  constructor(
    private readonly cardsService: CardsService,
    private readonly prisma: PrismaService, // Injeta o PrismaService
  ) {}

  @UseGuards(JwtClienteStrategy)
  @Post()
  create(@Body() newCard: CreateCardDto, candidato: UpdateCardDto) {
    return this.cardsService.create(newCard); // Retorna o resultado do serviço
  }

  @UseGuards(MultiRoleAuthGuard)
  @Get()
  async findAll(@Req() req: any) {
    let prestadorInfo = null;
    let clienteInfo = null;

    // Verifica se o usuário é um prestador
    if (req.user.role === 'prestador') {
      // Busca as informações do prestador na tabela
      // console.log('User Role prestador:', req.user?.role); // Verifique o role aqui também
      console.log('ID Prestador (req.user.sub):', req.user.sub);

      const prestador = await this.prisma.prestador.findUnique({
        where: { id_prestador: req.user.sub },
        select: {
          cpf: true,
          email: true,
          telefone: true,
        },
      });

      if (!prestador) {
        throw new Error('Prestador não encontrado.');
      }

      prestadorInfo = {
        cpf: prestador.cpf,
        email: prestador.email,
        telefone: prestador.telefone,
      };
    } else {
      // Verifica se o usuário é um prestador
      // Busca as informações do prestador na tabela
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: req.user.sub },
        select: {
          id_cliente: true, // Inclui o id_cliente
          cpf: true,
          email: true,
          telefone: true,
        },
      });

      console.log('User Role cliente:', req.user?.role); // Verifique o role aqui também

      if (!cliente) {
        throw new Error('cliente não encontrado.');
      }

      clienteInfo = cliente;
    }

    return this.cardsService.findAll(prestadorInfo, clienteInfo);
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
