import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PrestadorStatusService {
  private readonly logger = new Logger(PrestadorStatusService.name);

  constructor(private prisma: PrismaService) {}

  // Executa todo dia à meia-noite
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleInactiveAccounts() {
    this.logger.log(
      'Iniciando verificação de contas inativas (regra de 3 meses)...',
    );

    const agora = new Date();

    // 1. DATA LIMITE: 3 meses atrás (aprox. 90 dias)
    const tresMesesAtras = new Date(agora);
    tresMesesAtras.setMonth(agora.getMonth() - 3);

    try {
      // 2. Atualiza todos os prestadores que estão ATIVOS mas não acessam há 3 meses
      const updateResult = await this.prisma.prestador.updateMany({
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
          `Sucesso: ${updateResult.count} prestadores foram marcados como INATIVOS por inatividade.`,
        );
      } else {
        this.logger.log('Nenhum prestador pendente de inativação hoje.');
      }
    } catch (error) {
      this.logger.error('Erro ao processar inativação de contas:', error);
    }
  }

  /**
   * Método utilitário para ser chamado no Login ou em Middleware
   * sempre que o prestador fizer uma requisição
   */
  async updateLastAccess(id: number) {
    try {
      await this.prisma.prestador.update({
        where: { id_prestador: id },
        data: {
          ultimo_acesso: new Date(),
          status_conta: 'ATIVO', // Reativa automaticamente se ele voltar
        },
      });
    } catch (error) {
      // Falha silenciosa para não travar o login do usuário
      this.logger.error(
        `Erro ao atualizar último acesso do prestador ${id}:`,
        error,
      );
    }
  }
}
