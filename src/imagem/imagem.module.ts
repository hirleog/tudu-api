import { Module } from '@nestjs/common';
import { ImagemController } from './imagem.controller';
import { ImagemService } from './imagem.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [ImagemController],
  providers: [ImagemService],
  imports: [PrismaModule],
})
export class ImagemModule {}
