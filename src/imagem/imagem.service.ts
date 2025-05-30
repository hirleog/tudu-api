import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service'; // ajuste conforme seu projeto

@Injectable()
export class ImagemService {
  constructor(private prisma: PrismaService) {}

  async processarImagem(file: Express.Multer.File, id_pedido: string) {
    const webpFilename = file.filename.replace(/\.[^/.]+$/, '.webp');
    const webpPath = path.join('./uploads', webpFilename);

    // Converter para WebP
    await sharp(file.path).webp({ quality: 80 }).toFile(webpPath);

    // Deleta original
    fs.unlinkSync(file.path);

    // TODO: Subir para um serviço externo (S3, Cloudinary...) e obter a URL
    const fakeUrl = `http://localhost:3001/uploads/${webpFilename}`; // Exemplo local

    // Salva no banco
    const imagem = await this.prisma.imagem.create({
      data: {
        nome: 'nome da imagem',
        url: 'url da imagem',
        card: {
          connect: { id_pedido: id_pedido },
        },
      },
    });

    return imagem;
  }
}
