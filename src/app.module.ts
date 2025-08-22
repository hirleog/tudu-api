import { InstallmentsModule } from './getnet/installments/installments.module';
import { InstallmentsController } from './getnet/installments/controller/installments.controller';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { PrestadorModule } from './cliente copy/prestador.module';
import { ClienteModule } from './cliente/cliente.module';
import { EventsGateway } from './events/events.gateway';
import { GeolocationModule } from './geolocation/geolocation.module';
import { ImagemModule } from './imagem/imagem.module';
import { PaymentsModule } from './getnet/payments/payments.module';
import { PaymentsService } from './getnet/payments/payments.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
        InstallmentsModule, 
    CardsModule,
    ClienteModule,
    PrestadorModule,
    PrismaModule,
    AuthModule,

    ConfigModule.forRoot({
      isGlobal: true, // para estar disponível em toda a aplicação
    }),

    GeolocationModule,

    ImagemModule,

    PaymentsModule,
  ],
  controllers: [
        InstallmentsController, AppController],
  providers: [AppService, EventsGateway, PaymentsService],
})
export class AppModule {}
