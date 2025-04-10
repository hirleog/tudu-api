import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClienteController } from './controller/cliente.controller';
import { ClienteService } from './service/cliente.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClienteController],
  providers: [ClienteService],
})
export class ClienteModule {}
