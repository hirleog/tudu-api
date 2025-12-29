import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  InternalServerErrorException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Request,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { MultiRoleAuthGuard } from 'src/auth/guards/multi-role-auth.guard';
import { JwtClienteStrategy } from 'src/auth/jwt.strategy/jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';
import { CardsService } from './cards.service';
import { UpdateCardDto } from './dto/update-card.dto';

import { UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import * as sharp from 'sharp';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CancelCardDto } from './dto/cancel-card.dto';
import { Card } from './entities/showcase-card.entity';

@Controller('cards')
export class CardsController {
  constructor(
    private readonly cardsService: CardsService,
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // @UseGuards(JwtClienteStrategy)
  // @Post()
  // create(@Body() newCard: CreateCardDto, candidato: UpdateCardDto) {
  //   return this.cardsService.create(newCard); // Retorna o resultado do serviço
  // }

  @UseGuards(JwtClienteStrategy)
  @Post()
  @UseInterceptors(
    FilesInterceptor('imagens', 10, {
      storage: multer.memoryStorage(),
    }),
  )
  async createCard(
    @UploadedFiles() imagens: Express.Multer.File[],
    @Body('cardData') cardDataRaw: string,
  ) {
    let cardData;
    try {
      cardData = JSON.parse(cardDataRaw);
    } catch (error) {
      throw new BadRequestException('Dados inválidos no campo cardData');
    }

    const imageUrls: string[] = [];

    for (const file of imagens || []) {
      const webpBuffer = await sharp(file.buffer)
        .webp({ quality: 80 })
        .toBuffer();

      const uploadResult = await this.cloudinaryService.uploadCardAssets(
        webpBuffer,
        file.originalname,
      );

      imageUrls.push(uploadResult.secure_url);
    }

    // Cria o card APÓS fazer o upload de todas as imagens
    const novoCard = await this.cardsService.create(cardData, imageUrls);

    return novoCard; // Retorna o card criado com as imagens do DB
  }

  @UseGuards(MultiRoleAuthGuard)
  @Get()
  async findAll(
    @Req() req: any,
    @Query('status_pedido')
    status_pedido: 'publicado' | 'andamento' | 'finalizado',
    @Query('offset') offset: string,
    @Query('limit') limit: string,
    @Query('valorMin') valorMin?: string,
    @Query('valorMax') valorMax?: string,
    @Query('dataInicial') dataInicial?: string,
    @Query('dataFinal') dataFinal?: string,
    @Query('categoria') categoria?: string,
    @Query('filters') filters?: string,
  ) {
    // Conversão segura de query params
    const parsedOffset = Number(offset) || 0;
    const parsedLimit = Number(limit) || 10;

    const parsedDataInicial = dataInicial || undefined;
    const parsedDataFinal = dataFinal || undefined;

    // Tratamento seguro dos valores
    const parsedValorMin = valorMin
      ? parseFloat(valorMin.replace(',', '.'))
      : undefined;
    const parsedValorMax = valorMax
      ? parseFloat(valorMax.replace(',', '.'))
      : undefined;

    if (
      (parsedValorMin !== undefined && isNaN(parsedValorMin)) ||
      (parsedValorMax !== undefined && isNaN(parsedValorMax))
    ) {
      throw new BadRequestException(
        'Valores mínimo e máximo devem ser números válidos',
      );
    }

    if (!req.user.role) {
      throw new Error('Prestador não encontrado.');
    }

    let prestadorInfo = null;
    let clienteInfo = null;

    if (req.user.role === 'prestador') {
      const prestador = await this.prisma.prestador.findUnique({
        where: { id_prestador: req.user.sub },
        select: {
          cpf: true,
          email: true,
          telefone: true,
        },
      });

      prestadorInfo = {
        id_prestador: req.user.sub,
        cpf: prestador?.cpf,
        email: prestador?.email,
        telefone: prestador?.telefone,
      };
    } else if (req.user.role === 'cliente') {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: req.user.sub },
        select: {
          id_cliente: true,
          cpf: true,
          email: true,
          telefone: true,
        },
      });

      clienteInfo = cliente;
    }

    return this.cardsService.findAll(
      prestadorInfo,
      clienteInfo,
      status_pedido,
      parsedOffset,
      parsedLimit,
      parsedValorMin,
      parsedValorMax,
      parsedDataInicial,
      parsedDataFinal,
      categoria,
    );
  }

  @UseGuards(MultiRoleAuthGuard)
  @Get(':id_pedido')
  async findById(
    @Req() req: any,
    @Param('id_pedido') id_pedido: string,
    @Headers('id_prestador') idPrestadorHeader?: string,
  ) {
    let prestadorInfo = null;
    let clienteInfo = null;

    // Extrai o id_prestador do header, se existir
    const idPrestadorFromHeader = idPrestadorHeader?.trim() || null;

    if (req.user.role === 'prestador') {
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
        id_prestador: req.user.sub,
        cpf: prestador.cpf,
        email: prestador.email,
        telefone: prestador.telefone,
      };
    } else if (req.user.role === 'cliente') {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: req.user.sub },
        select: {
          id_cliente: true,
          cpf: true,
          email: true,
          telefone: true,
        },
      });

      if (!cliente) {
        throw new Error('Cliente não encontrado.');
      }

      clienteInfo = {
        id_cliente: cliente.id_cliente,
        cpf: cliente.cpf,
        email: cliente.email,
        telefone: cliente.telefone,
      };
    }

    // Se veio id_prestador no header, usa ele no service
    return this.cardsService.findById(
      id_pedido,
      prestadorInfo,
      clienteInfo,
    );
  }

  @Put(':id_pedido')
  update(
    @Param('id_pedido') id_pedido: string,
    @Body() updatedCard: UpdateCardDto,
    @Req() req: any, // Injetando o contexto da requisição
  ) {
    return this.cardsService.update(id_pedido, updatedCard); // Atualiza um card
  }

  @UseGuards(MultiRoleAuthGuard)
  @Get('list/showcase')
  async getServiceCards(@Req() req): Promise<{ cards: Card[]; counts: any }> {
    try {
      const userId = req.user?.sub || undefined;
      return await this.cardsService.getServiceCardsWithDisabled(userId);
    } catch (error) {
      console.error('Error in /list/showcase endpoint:', error);
      throw new InternalServerErrorException('Failed to load showcase cards');
    }
  }

  @UseGuards(MultiRoleAuthGuard)
  @Delete(':id/cancel')
  async cancel(
    @Param('id') id_pedido: string,
    @Body() cancelCardDto: CancelCardDto,
    @Request() req,
  ) {
    return this.cardsService.cancel(id_pedido, cancelCardDto, {
      id_cliente: req.user.sub,
      role: req.user.role,
    });
  }

  @UseGuards(MultiRoleAuthGuard)
  @Delete('/candidatura/:id_pedido/:id_candidatura')
  async cancelarCandidatura(
    @Param('id_pedido') id_pedido: string,
    @Param('id_candidatura') id_candidatura: string,
    @Request() req,
  ) {
    return this.cardsService.cancelarCandidatura(id_pedido, id_candidatura, {
      id_cliente: req.user.sub,
      role: req.user.role,
    });
  }

  @Get('categorias/highlights')
  async getHighlightsCategorias() {
    return this.cardsService.getHighlightsCategorias();
  }
}
