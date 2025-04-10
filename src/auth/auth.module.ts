import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy/jwt.strategy';
import * as dotenv from 'dotenv';

dotenv.config();

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: 'ewfj/DwBZAe0Z7IVho8zrn89HN9VI7nVTzVK9/JIlAY=', // Substitua pela sua chave secreta
      signOptions: { expiresIn: '1h' }, // Token expira em 1 hora
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, JwtStrategy],
})
export class AuthModule {}
