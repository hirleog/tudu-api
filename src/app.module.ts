import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CardsModule } from './cards/cards.module';
import { PrismaModule } from './prisma/prisma.module';
import { ClienteModule } from './cliente/cliente.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [CardsModule, ClienteModule, PrismaModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
