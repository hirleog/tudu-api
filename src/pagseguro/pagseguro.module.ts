import { Module } from '@nestjs/common';
import { PagSeguroController } from './controller/pagseguro.controller';
import { PagSeguroService } from './service/pagseguro.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from 'src/prisma/prisma.service';
import * as https from 'https';
import { EventsGateway } from 'src/events/events.gateway';
import { NotificationsService } from 'src/notifications/service/notifications.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 30000,
        maxRedirects: 5,
        // ✅ SOLUÇÃO: Ignorar SSL em desenvolvimento
        httpsAgent: new https.Agent({
          rejectUnauthorized: false, // ⚠️ APENAS PARA DESENVOLVIMENTO
        }),
      }),
    }),
    ConfigModule,
  ],
  controllers: [PagSeguroController],
  providers: [
    PagSeguroService,
    PrismaService,
    EventsGateway,
    NotificationsService,
  ],
  exports: [PagSeguroService, EventsGateway],
})
export class PagSeguroModule {}
