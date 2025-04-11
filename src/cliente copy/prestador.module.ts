import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrestadorController } from './controller/prestador.controller';
import { PrestadorService } from './service/prestador.service';

@Module({
  imports: [PrismaModule],
  controllers: [PrestadorController],
  providers: [PrestadorService],
})
export class PrestadorModule {}
