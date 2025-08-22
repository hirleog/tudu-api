// src/installments/installments.module.ts
import { Module } from '@nestjs/common';
import { InstallmentsController } from './controller/installments.controller';
import { InstallmentsService } from './service/installments.service';

@Module({
  controllers: [InstallmentsController],
  providers: [InstallmentsService],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}
