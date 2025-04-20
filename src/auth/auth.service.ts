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
    const cliente = await this.prisma.cliente.findUnique({ where: { email } });

    if (!cliente) {
      throw new UnauthorizedException('Email ou senha inválidos.');
    }

    const isPasswordValid = await bcrypt.compare(password, cliente.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou senha inválidos.');
    }

    return cliente;
  }

  async validatePrestador(email: string, password: string) {
    const prestador = await this.prisma.prestador.findUnique({
      where: { email },
    });

    if (!prestador) {
      throw new UnauthorizedException('Email ou senha inválidos.');
    }

    const isPasswordValid = await bcrypt.compare(password, prestador.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou senha inválidos.');
    }

    return prestador;
  }

  async loginCliente(cliente: any) {
    const payload = {
      sub: cliente.id_cliente,
      role: 'cliente', // Identifica o tipo de usuário
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async loginPrestador(prestador: any) {
    const payload = {
      sub: prestador.id_prestador,
      role: 'prestador', // Identifica o tipo de usuário
    };
    return {
      role: 'prestador', // Identifica o tipo de usuário
      access_token: this.jwtService.sign(payload),
    };
  }
}
