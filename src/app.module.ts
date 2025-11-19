import { IpDeviceController } from './getnet/ip-device/ip-device.controller';
import { EmailService } from './email/email.service';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { ClienteModule } from './cliente/cliente.module';
import { VerificationService } from './email/verification.service';
import { EventsGateway } from './events/events.gateway';
import { ExperienciaModule } from './experience/experience.module';
import { GeolocationModule } from './geolocation/geolocation.module';
import { InstallmentsController } from './getnet/installments/controller/installments.controller';
import { InstallmentsModule } from './getnet/installments/installments.module';
import { PaymentsModule } from './getnet/payments/payments.module';
import { PaymentsService } from './getnet/payments/payments.service';
import { ImagemModule } from './imagem/imagem.module';
import { PrestadorModule } from './prestador/prestador.module';
import { PrismaModule } from './prisma/prisma.module';
import { MalgaModule } from './malga/malga.module';
import { PagSeguroModule } from './pagseguro/pagseguro.module';

@Module({
  imports: [
    InstallmentsModule,
    CardsModule,
    ClienteModule,
    PrestadorModule,
    PrismaModule,
    AuthModule,
    MalgaModule,
    ExperienciaModule,
    PagSeguroModule,
    ConfigModule.forRoot({
      isGlobal: true, // para estar disponível em toda a aplicação
    }),

    GeolocationModule,

    ImagemModule,

    PaymentsModule,
  ],
  controllers: [IpDeviceController, InstallmentsController, AppController],
  providers: [
    EmailService,
    VerificationService,
    AppService,
    EventsGateway,
    PaymentsService,
  ],
})
export class AppModule {}
