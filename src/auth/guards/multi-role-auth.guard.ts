import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class MultiRoleAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Verifica se o token está presente no cabeçalho
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Token não encontrado.');
    }

    // Tenta determinar o role do usuário
    try {
      // Use a estratégia 'jwt-cliente'
      const clienteGuard = new (AuthGuard('jwt-cliente'))();
      const clienteResult = await clienteGuard.canActivate(context);

      if (clienteResult) {
        return true; // Cliente autenticado com sucesso
      }
    } catch (err) {
      // Ignora o erro e tenta a próxima estratégia
    }

    try {
      // Use a estratégia 'jwt-prestador'
      const prestadorGuard = new (AuthGuard('jwt-prestador'))();
      const prestadorResult = await prestadorGuard.canActivate(context);

      if (prestadorResult) {
        return true; // Prestador autenticado com sucesso
      }
    } catch (err) {
      // Ignora o erro e lança uma exceção se nenhuma estratégia funcionar
    }

    throw new UnauthorizedException('Usuário não autorizado.');
  }
}
