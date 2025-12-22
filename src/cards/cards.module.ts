import { Module } from '@nestjs/common';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { InstallmentsService } from 'src/getnet/installments/service/installments.service';
import { PaymentsService } from 'src/getnet/payments/payments.service';
import { NotificationsService } from 'src/notifications/service/notifications.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { EventsModule } from 'src/events/events.module';

@Module({
  imports: [PrismaModule, CloudinaryModule, EventsModule],
  controllers: [CardsController],
  providers: [
    CardsService,
    PaymentsService,
    InstallmentsService,
    NotificationsService,
  ],
  exports: [],
})
export class CardsModule {}
