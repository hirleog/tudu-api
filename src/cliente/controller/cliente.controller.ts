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
import { CreateClienteDto } from '../dto/create-cliente.dto';
import { UpdateClienteDto } from '../dto/update-client.dto';
import { ClienteService } from '../service/cliente.service';

import { UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as sharp from 'sharp';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ChangePasswordDto, RequestPasswordResetDto, VerifyResetCodeDto } from 'src/prestador/dto/change-password.dto';

@Controller('clientes')
export class ClienteController {
  constructor(
    private readonly clienteService: ClienteService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  async createCliente(@Body() createClienteDto: CreateClienteDto) {
    return this.clienteService.createCliente(createClienteDto);
  }

  @Get()
  async findAllClientes() {
    return this.clienteService.findAllClientes();
  }

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.clienteService.getById(id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('foto'))
  async updateCliente(
    @Param('id', ParseIntPipe) id: number,
    @Body('data') updateClienteDto: string,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    let fotoUrl: string | undefined;
    let updateCliente: UpdateClienteDto;

    try {
      updateCliente = JSON.parse(updateClienteDto);
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
          await this.cloudinaryService.uploadProfileClienteImg(
            webpBuffer,
            foto.originalname,
          );

        fotoUrl = uploadResult.secure_url;
      } catch (error) {
        throw new BadRequestException('Falha no processamento da imagem');
      }
    } else {
    }

    const result = await this.clienteService.update(id, updateCliente, fotoUrl);

    return result;
  }

  // FLUXO DE REDEFINIÇÃO DE SENHA COM TOKEN DE VERIFICAÇÃO POR EMAIL
  @Post('request-password-reset')
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
  ) {
    try {
      await this.clienteService.requestPasswordReset(requestPasswordResetDto);
      return { message: 'Código de verificação enviado para o email' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('verify-reset-code')
  async verifyResetCode(@Body() verifyResetCodeDto: VerifyResetCodeDto) {
    try {
      const isValid =
        await this.clienteService.verifyResetCode(verifyResetCodeDto);
      return { valid: isValid, message: 'Código válido' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Patch('reset/password')
  async resetPasswordWithCode(@Body() changePasswordDto: ChangePasswordDto) {
    try {
      const result =
        await this.clienteService.resetPasswordWithCode(changePasswordDto);
      return { message: 'Senha redefinida com sucesso' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
