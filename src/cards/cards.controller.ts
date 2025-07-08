import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
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

      const uploadResult = await this.cloudinaryService.uploadImage(
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
  ) {
    // Conversão segura de query params
    const parsedOffset = Number(offset) || 0;
    const parsedLimit = Number(limit) || 10;
    const parsedValorMin = valorMin ? parseFloat(valorMin) : undefined;
    const parsedValorMax = valorMax ? parseFloat(valorMax) : undefined;

    const parsedDataInicial = dataInicial || undefined;
    const parsedDataFinal = dataFinal || undefined;

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
  async findById(@Req() req: any, @Param('id_pedido') id_pedido: string) {
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

      if (!prestador) {
        throw new Error('Prestador não encontrado.');
      }

      prestadorInfo = {
        id_prestador: req.user.sub,
      };
    } else {
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
      };
    }

    return this.cardsService.findById(id_pedido, prestadorInfo, clienteInfo);
  }

  @Put(':id_pedido')
  update(
    @Param('id_pedido') id_pedido: string,
    @Body() updatedCard: UpdateCardDto,
    @Req() req: any, // Injetando o contexto da requisição
  ) {
    return this.cardsService.update(id_pedido, updatedCard); // Atualiza um card
  }
}
