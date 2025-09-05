import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InstallmentsService } from '../installments/service/installments.service';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, InstallmentsService],
  exports: [PaymentsService, InstallmentsService], // precisa exportar
})
export class PaymentsModule {}
