import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClienteStatusService } from 'src/cliente/cliente-status.service';
import { PrestadorStatusService } from 'src/prestador/prestador-status.service';

@Injectable()
export class UpdateLastAccessInterceptor implements NestInterceptor {
  private readonly logger = new Logger('InterceptorDebug');

  constructor(
    private clienteStatusService: ClienteStatusService,
    private prestadorStatusService: PrestadorStatusService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && user.sub) {
      if (user.role === 'cliente') {
        // O serviço agora decide se deve ou não atualizar o DB (trava de 24h)
        this.clienteStatusService.updateLastAccess(user.sub);
      } else if (user.role === 'prestador') {
        this.prestadorStatusService.updateLastAccess(user.sub);
      }
    }

    return next.handle();
  }
}
