import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ClienteStatusService {
  private readonly logger = new Logger(ClienteStatusService.name);
  private lastUpdateCache = new Map<number, string>();
  
  constructor(private prisma: PrismaService) {}

  // Executa todo dia à meia-noite para verificar inatividade
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleInactiveAccounts() {
    this.logger.log(
      'Iniciando verificação de clientes inativos (regra de 3 meses)...',
    );

    const agora = new Date();
    const tresMesesAtras = new Date(agora);
    tresMesesAtras.setMonth(agora.getMonth() - 3);

    try {
      // Atualiza clientes ATIVOS que não acessam há mais de 3 meses
      const updateResult = await this.prisma.cliente.updateMany({
        where: {
          status_conta: 'ATIVO',
          ultimo_acesso: {
            lt: tresMesesAtras,
          },
        },
        data: {
          status_conta: 'INATIVO',
        },
      });

      if (updateResult.count > 0) {
        this.logger.log(
          `Sucesso: ${updateResult.count} clientes foram marcados como INATIVOS por inatividade.`,
        );
      } else {
        this.logger.log('Nenhum cliente pendente de inativação hoje.');
      }
    } catch (error) {
      this.logger.error(
        'Erro ao processar inativação de contas de clientes:',
        error,
      );
    }
  }

  /**
   * Atualiza o timestamp de acesso e garante que a conta esteja ATIVA.
   * Chame este método no AuthController (Login) ou em um Interceptor/Middleware de Cliente.
   */
  async updateLastAccess(id: number) {
    const hoje = new Date().toISOString().split('T')[0]; // Ex: "2026-01-10"
    const ultimoUpdateRegistrado = this.lastUpdateCache.get(id);

    // Se já atualizamos o banco hoje para este ID, não fazemos nada
    if (ultimoUpdateRegistrado === hoje) {
      return;
    }

    // Se chegou aqui, é a primeira vez que ele acessa no dia (ou o servidor reiniciou)
    try {
      this.lastUpdateCache.set(id, hoje); // Marca no cache antes para evitar concorrência

      await this.prisma.cliente.update({
        where: { id_cliente: id },
        data: {
          ultimo_acesso: new Date(),
          status_conta: 'ATIVO',
        },
      });
    } catch (error) {
      this.lastUpdateCache.delete(id); // Se der erro, remove do cache para tentar de novo na próxima
    }
  }
}
