import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { CreatePrestadorDto } from '../dto/create-prestador.dto';
import { UpdatePrestadorDto } from '../dto/update-prestador.dto';
import { PrestadorService } from '../service/prestador.service';

import { UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as sharp from 'sharp';

import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Controller('prestadores')
export class PrestadorController {
  constructor(
    private readonly prestadorService: PrestadorService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.prestadorService.getById(id);
  }

  @Post()
  async createPrestador(@Body() createPrestadorDto: CreatePrestadorDto) {
    return this.prestadorService.createPrestador(createPrestadorDto);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('foto'))
  async updatePrestador(
    @Param('id', ParseIntPipe) id: number,
    @Body('data') updatePrestadorDtoRaw: string,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    console.log('DEBUG: Chegou no método updatePrestador');
    console.log('DEBUG: ID:', id);
    console.log('DEBUG: Foto recebida:', foto);
    console.log('DEBUG: Dados raw:', updatePrestadorDtoRaw);

    let fotoUrl: string | undefined;
    let updatePrestadorDto: UpdatePrestadorDto;

    try {
      updatePrestadorDto = JSON.parse(updatePrestadorDtoRaw);
      console.log('DEBUG: Dados parseados:', updatePrestadorDto);
    } catch (error) {
      console.error('DEBUG: Erro no parse JSON:', error);
      throw new BadRequestException('Dados inválidos no campo data');
    }

    // Processa apenas se uma foto foi enviada
    if (foto) {
      console.log('DEBUG: Processando foto...');
      console.log('DEBUG: Foto info:', {
        fieldname: foto.fieldname,
        originalname: foto.originalname,
        mimetype: foto.mimetype,
        size: foto.size,
      });

      try {
        const webpBuffer = await sharp(foto.buffer)
          .webp({ quality: 80 })
          .toBuffer();

        const uploadResult =
          await this.cloudinaryService.uploadProfilePrestadorImg(
            webpBuffer,
            foto.originalname,
          );

        fotoUrl = uploadResult.secure_url;
        console.log('DEBUG: Foto processada, URL:', fotoUrl);
      } catch (error) {
        console.error('DEBUG: Erro no processamento da imagem:', error);
        throw new BadRequestException('Falha no processamento da imagem');
      }
    } else {
      console.log('DEBUG: Nenhuma foto recebida');
    }

    const result = await this.prestadorService.update(
      id,
      updatePrestadorDto,
      fotoUrl,
    );
    console.log('DEBUG: Update finalizado:', result);

    return result;
  }
}
