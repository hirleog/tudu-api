import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateCliente(email: string, password: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { email },
    });

    if (!cliente) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, cliente.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return cliente;
  }

  async login(cliente: any) {
    const payload = { sub: cliente.id_cliente, email: cliente.email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
