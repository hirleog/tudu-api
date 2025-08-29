import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ExperienciaController } from './controller/experience.controller';
import { ExperienciaService } from './service/experience.service';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [ExperienciaController],
  providers: [ExperienciaService],
  exports: [ExperienciaService],
})
export class ExperienciaModule {}
