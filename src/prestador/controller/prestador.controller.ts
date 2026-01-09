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
  UploadedFiles,
} from '@nestjs/common';
import { UpdatePrestadorDto } from '../dto/update-prestador.dto';
import { PrestadorService } from '../service/prestador.service';

import { UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import * as sharp from 'sharp';

import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import {
  ChangePasswordDto,
  RequestPasswordResetDto,
  VerifyResetCodeDto,
} from '../dto/change-password.dto';

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
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'documento_frente', maxCount: 1 },
      { name: 'documento_verso', maxCount: 1 },
    ]),
  )
  async createPrestador(
    @Body('prestadorData') prestadorDataRaw: string,
    @UploadedFiles()
    files: {
      documento_frente?: Express.Multer.File[];
      documento_verso?: Express.Multer.File[];
    },
  ) {
    // Importante: parsear o JSON que o FormData enviou como string
    const createPrestadorDto = JSON.parse(prestadorDataRaw);
    return this.prestadorService.createPrestador(createPrestadorDto, files);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('foto'))
  async updatePrestador(
    @Param('id', ParseIntPipe) id: number,
    @Body('data') updatePrestadorDtoRaw: string,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    let fotoUrl: string | undefined;
    let updatePrestadorDto: UpdatePrestadorDto;

    try {
      updatePrestadorDto = JSON.parse(updatePrestadorDtoRaw);
    } catch (error) {
      console.error('DEBUG: Erro no parse JSON:', error);
      throw new BadRequestException('Dados inválidos no campo data');
    }

    // Processa apenas se uma foto foi enviada
    if (foto) {
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
      } catch (error) {
        console.error('DEBUG: Erro no processamento da imagem:', error);
        throw new BadRequestException('Falha no processamento da imagem');
      }
    } else {
    }

    const result = await this.prestadorService.update(
      id,
      updatePrestadorDto,
      fotoUrl,
    );

    return result;
  }

  // FLUXO DE REDEFINIÇÃO DE SENHA COM TOKEN DE VERIFICAÇÃO POR EMAIL
  @Post('request-password-reset')
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
  ) {
    try {
      await this.prestadorService.requestPasswordReset(requestPasswordResetDto);
      return { message: 'Código de verificação enviado para o email' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() verifyResetCodeDto: VerifyResetCodeDto) {
    try {
      const isValid =
        await this.prestadorService.verifyResetCode(verifyResetCodeDto);
      return { valid: isValid, message: 'Código válido' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Patch('reset/password')
  async resetPasswordWithCode(@Body() changePasswordDto: ChangePasswordDto) {
    try {
      const result =
        await this.prestadorService.resetPasswordWithCode(changePasswordDto);
      return { message: 'Senha redefinida com sucesso' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
