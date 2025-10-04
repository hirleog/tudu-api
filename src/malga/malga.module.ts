// src/malga/malga.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MalgaService } from './service/malga.service';
import { MalgaController } from './controller/malga.controller';
import { PaymentsService } from 'src/getnet/payments/payments.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { InstallmentsService } from 'src/getnet/installments/service/installments.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    MalgaService,
    PaymentsService,
    PrismaService,
    InstallmentsService,
  ],
  controllers: [MalgaController],
  exports: [MalgaService],
})
export class MalgaModule {}
