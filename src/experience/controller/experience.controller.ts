import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import * as sharp from 'sharp';
import { JwtPrestadorStrategy } from 'src/auth/jwt.strategy/jwt.strategy';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { UpdateExperienciaDto } from '../dto/update-experiencia.dto';
import { ExperienciaService } from '../service/experience.service';

@Controller('experiencias')
export class ExperienciaController {
  constructor(
    private readonly experienciaService: ExperienciaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  @UseGuards(JwtPrestadorStrategy)
  @Post()
  @UseInterceptors(
    FilesInterceptor('imagens', 3, {
      // Máximo 3 imagens
      storage: multer.memoryStorage(),
    }),
  )
  async create(
    @UploadedFiles() imagens: Express.Multer.File[],
    @Body('experienceData') experienceDataRaw: string,
  ) {
    let experienceData;
    try {
      experienceData = JSON.parse(experienceDataRaw);
    } catch (error) {
      throw new BadRequestException('Dados inválidos no campo experienceData');
    }

    const imageUrls: string[] = [];

    // Processa as imagens se houver
    if (imagens && imagens.length > 0) {
      for (const file of imagens) {
        try {
          const webpBuffer = await sharp(file.buffer)
            .webp({ quality: 80 })
            .toBuffer();

          const uploadResult =
            await this.cloudinaryService.uploadExperienceAssets(
              webpBuffer,
              file.originalname,
            );

          imageUrls.push(uploadResult.secure_url);
        } catch (error) {
          throw new BadRequestException('Falha no processamento da imagem');
        }
      }
    }

    // Cria a experiência APÓS fazer o upload de todas as imagens
    const novaExperiencia = await this.experienciaService.create(
      experienceData,
      imageUrls,
    );

    return novaExperiencia;
  }

  @Get('prestador/:prestadorId')
  async findAllByPrestador(
    @Param('prestadorId', ParseIntPipe) prestadorId: number,
  ) {
    return this.experienciaService.findAllByPrestador(prestadorId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.experienciaService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateExperienciaDto: UpdateExperienciaDto,
  ) {
    return this.experienciaService.update(id, updateExperienciaDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.experienciaService.remove(id);
  }

  @Post(':id/imagens')
  @UseInterceptors(
    FilesInterceptor('imagens', 3, {
      storage: multer.memoryStorage(),
    }),
  )
  // async addImagens(
  //   @Param('id', ParseIntPipe) id: number,
  //   @UploadedFiles() imagens: Express.Multer.File[],
  // ) {
  //   const imageUrls: string[] = [];

  //   if (imagens && imagens.length > 0) {
  //     for (const file of imagens) {
  //       try {
  //         const webpBuffer = await sharp(file.buffer)
  //           .webp({ quality: 80 })
  //           .toBuffer();

  //         const uploadResult =
  //           await this.cloudinaryService.uploadExperienceAssets(
  //             webpBuffer,
  //             file.originalname,
  //           );

  //         imageUrls.push(uploadResult.secure_url);
  //       } catch (error) {
  //         throw new BadRequestException('Falha no processamento da imagem');
  //       }
  //     }
  //   }

  //   return this.experienciaService.addImagens(id, imageUrls);
  // }
  @Delete('imagem/:imagemId')
  async removeImagem(@Param('imagemId', ParseIntPipe) imagemId: number) {
    return this.experienciaService.removeImagem(imagemId);
  }
}
