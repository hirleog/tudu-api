import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async request(err, user, info, context) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    const request = context.switchToHttp().getRequest();

    // Busca informações adicionais no banco de dados
    if (user.role === 'prestador') {
      const prestador = await this.prisma.prestador.findUnique({
        where: { id_prestador: user.sub },
        select: {
          cpf: true,
          email: true,
          telefone: true,
        },
      });

      if (!prestador) {
        throw new UnauthorizedException('Prestador não encontrado.');
      }

      // Adiciona as informações ao req.user
      request.user = { ...user, ...prestador };
    } else if (user.role === 'cliente') {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: user.sub },
        select: {
          cpf: true,
          email: true,
          telefone: true,
        },
      });

      if (!cliente) {
        throw new UnauthorizedException('Cliente não encontrado.');
      }

      // Adiciona as informações ao req.user
      request.user = { ...user, ...cliente };
    }

    return user;
  }
}