import { Module } from '@nestjs/common';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { EmailService } from 'src/email/email.service';
import { VerificationService } from 'src/email/verification.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrestadorController } from './controller/prestador.controller';
import { PrestadorService } from './service/prestador.service';
import { PrestadorStatusService } from './prestador-status.service';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [PrestadorController],
  providers: [
    PrestadorService,
    EmailService,
    VerificationService,
    EmailService,
    PrestadorStatusService,
  ],
})
export class PrestadorModule {}
