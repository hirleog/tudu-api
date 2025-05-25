import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CardsModule } from './cards/cards.module';
import { PrismaModule } from './prisma/prisma.module';
import { ClienteModule } from './cliente/cliente.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrestadorModule } from './cliente copy/prestador.module';
import { EventsGateway } from './events/events.gateway';

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
  ],
  controllers: [AppController],
  providers: [AppService, EventsGateway],
})
export class AppModule {}
