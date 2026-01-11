import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PrestadorStatusService {
  private readonly logger = new Logger(PrestadorStatusService.name);

  // Cache para evitar múltiplos updates no DB no mesmo dia
  // Armazena: { id_prestador: "YYYY-MM-DD" }
  private lastUpdateCache = new Map<number, string>();

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleInactiveAccounts() {
    this.logger.log(
      'Iniciando verificação de prestadores inativos (3 meses)...',
    );

    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

    try {
      const updateResult = await this.prisma.prestador.updateMany({
        where: {
          status_conta: 'ATIVO',
          ultimo_acesso: { lt: tresMesesAtras },
        },
        data: { status_conta: 'INATIVO' },
      });

      if (updateResult.count > 0) {
        this.logger.log(
          `Sucesso: ${updateResult.count} prestadores inativados.`,
        );
      }
    } catch (error) {
      this.logger.error('Erro ao processar inativação de prestadores:', error);
    }
  }

  /**
   * Atualiza o acesso com trava de 24 horas para performance otimizada.
   */
  async updateLastAccess(id: number) {
    const hoje = new Date().toISOString().split('T')[0]; // Ex: "2026-01-10"
    const ultimoUpdate = this.lastUpdateCache.get(id);

    // Se já atualizamos hoje, encerramos aqui (sem bater no banco)
    if (ultimoUpdate === hoje) {
      return;
    }

    try {
      // Atualizamos o cache antes para evitar disparos simultâneos (race conditions)
      this.lastUpdateCache.set(id, hoje);

      await this.prisma.prestador.update({
        where: { id_prestador: id },
        data: {
          ultimo_acesso: new Date(),
          status_conta: 'ATIVO',
        },
      });

      this.logger.debug(
        `DB Atualizado: Último acesso do prestador ${id} registrado.`,
      );
    } catch (error) {
      // Se falhar, removemos do cache para tentar novamente na próxima requisição
      this.lastUpdateCache.delete(id);
      this.logger.error(
        `Erro ao atualizar último acesso do prestador ${id}:`,
        error,
      );
    }
  }
}
