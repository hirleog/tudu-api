import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImagemService } from './imagem.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('imagem')
export class ImagemController {
  constructor(private readonly imagemService: ImagemService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads', // pasta temporária local
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(
            Math.random() * 1e9,
          )}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadImagem(
    @UploadedFile() file: Express.Multer.File,
    @Query('id_pedido') id_pedido: string, // capturando o id do card na query
  ) {
    if (!id_pedido) {
      throw new BadRequestException('id_pedido is required');
    }

    // Passa o id_pedido junto com o arquivo para o service
    return this.imagemService.processarImagem(file, id_pedido);
  }
}
