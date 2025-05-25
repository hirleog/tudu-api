import { Module } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsGateway } from 'src/events/events.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [CardsController],
  providers: [CardsService, EventsGateway],
  exports: [EventsGateway],
})
export class CardsModule {}
