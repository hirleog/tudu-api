import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  mixin,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class MultiRoleAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token não fornecido');
    }

    // Tenta autenticar como cliente primeiro
    try {
      const clienteGuard = this.getAuthGuard('jwt-cliente');
      await clienteGuard.canActivate(context);
      request.userType = 'cliente';
      return true;
    } catch (clienteError) {
      // Se falhar, tenta como prestador
      try {
        const prestadorGuard = this.getAuthGuard('jwt-prestador');
        await prestadorGuard.canActivate(context);
        request.userType = 'prestador';
        return true;
      } catch (prestadorError) {
        // Analisa qual erro mostrar
        throw this.determineBestError(clienteError, prestadorError);
      }
    }
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers['authorization'];
    if (!authHeader) return null;
    
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private getAuthGuard(strategy: string): any {
    return new (class extends AuthGuard(strategy) {
      constructor() {
        super();
      }

      handleRequest(err: any, user: any, info: any) {
        if (err || !user) {
          // Mensagem mais específica para tokens expirados
          if (info && info.name === 'TokenExpiredError') {
            throw new UnauthorizedException('Token expirado');
          }
          throw new UnauthorizedException('Token inválido');
        }
        return user;
      }
    })();
  }

  private determineBestError(clienteError: any, prestadorError: any): UnauthorizedException {
    // Prioriza erros de token expirado sobre inválidos
    const errors = [clienteError, prestadorError];
    const expiredError = errors.find(e => e?.response?.message === 'Token expirado');
    
    return expiredError || 
      new UnauthorizedException('Credenciais inválidas para ambos cliente e prestador');
  }
}