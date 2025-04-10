import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  async register(@Body() body: any) {
    const hashedPassword = await bcrypt.hash(body.password, 10);

    const cliente = await this.prisma.cliente.create({
      data: {
        nome: body.nome,
        sobrenome: body.sobrenome,
        email: body.email,
        telefone: body.telefone,
        password: hashedPassword,
      },
    });

    return cliente;
  }

  @Post('login')
  async login(@Body() body: any) {
    const cliente = await this.authService.validateCliente(
      body.email,
      body.password,
    );
    return this.authService.login(cliente);
  }
}
