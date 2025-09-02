import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrestadorController } from './controller/prestador.controller';
import { PrestadorService } from './service/prestador.service';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { VerificationService } from 'src/email/verification.service';
import { EmailService } from 'src/email/email.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [PrestadorController],
  providers: [PrestadorService, EmailService, VerificationService],
})
export class PrestadorModule {}
