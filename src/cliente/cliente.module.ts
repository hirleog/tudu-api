import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ClienteController } from './controller/cliente.controller';
import { ClienteService } from './service/cliente.service';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { VerificationService } from 'src/email/verification.service';
import { EmailService } from 'src/email/email.service';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [ClienteController],
  providers: [ClienteService, EmailService, VerificationService],
})
export class ClienteModule {}
