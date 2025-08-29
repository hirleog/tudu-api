import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrestadorController } from './controller/prestador.controller';
import { PrestadorService } from './service/prestador.service';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [PrestadorController],
  providers: [PrestadorService],
})
export class PrestadorModule {}
