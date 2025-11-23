import { Module } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsGateway } from 'src/events/events.gateway';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { PaymentsService } from 'src/getnet/payments/payments.service';
import { InstallmentsService } from 'src/getnet/installments/service/installments.service';
import { WApiModule } from 'src/wapi/wapi.module';
import { NotificationsService } from 'src/notifications/service/notifications.service';

@Module({
  imports: [PrismaModule, CloudinaryModule, WApiModule],
  controllers: [CardsController],
  providers: [
    CardsService,
    EventsGateway,
    PaymentsService,
    InstallmentsService,
    NotificationsService,
  ],
  exports: [EventsGateway],
})
export class CardsModule {}
