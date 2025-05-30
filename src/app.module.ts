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
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [AppService, EventsGateway],
})
export class AppModule {}
