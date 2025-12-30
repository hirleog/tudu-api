import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationCleanupService {
  private readonly logger = new Logger(NotificationCleanupService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanAdvancedNotifications() {
    this.logger.log('Iniciando limpeza avançada de notificações...');

    const agora = new Date();

    // 1. DATA LIMITE: Voláteis (7 dias)
    const seteDiasAtras = new Date(agora);
    seteDiasAtras.setDate(agora.getDate() - 7);

    // 2. DATA LIMITE: Padrão (10 dias)
    const dezDiasAtras = new Date(agora);
    dezDiasAtras.setDate(agora.getDate() - 10);

    // 3. DATA LIMITE: Segurança/Geral (90 dias)
    const noventaDiasAtras = new Date(agora);
    noventaDiasAtras.setDate(agora.getDate() - 90);

    try {
      const [volatiles, standards, oldies] = await Promise.all([
        // A. Limpa informativas lidas após 7 dias
        this.prisma.notification.deleteMany({
          where: {
            read: true,
            status: { in: ['NEW_CANDIDATURE', 'NEW_CARD'] },
            createdAt: { lt: seteDiasAtras },
          },
        }),

        // B. Limpa as demais lidas após 10 dias, EXCETO as críticas/transacionais
        this.prisma.notification.deleteMany({
          where: {
            read: true,
            createdAt: { lt: dezDiasAtras },
            // ✅ Protegemos notificações de pagamento e contrato da regra dos 10 dias
            status: {
              notIn: [
                'PAYMENT_SUCCESS',
                'HIRE_CONFIRMED',
                'CONTRACT_CANCELLED',
                'CARD_CANCELLED',
              ],
            },
          },
        }),

        // C. Limpa ABSOLUTAMENTE TUDO com mais de 90 dias
        this.prisma.notification.deleteMany({
          where: {
            createdAt: { lt: noventaDiasAtras },
          },
        }),
      ]);

      const totalDeleted = volatiles.count + standards.count + oldies.count;

      if (totalDeleted > 0) {
        this.logger.log(`Limpeza concluída com sucesso.`);
        this.logger.log(`- ${volatiles.count} Voláteis (7d) removidas.`);
        this.logger.log(
          `- ${standards.count} Padrão (10d) removidas (Protegendo críticas).`,
        );
        this.logger.log(`- ${oldies.count} Antigas/Inativas (90d) removidas.`);
      } else {
        this.logger.log('Nenhuma notificação encontrada para limpeza hoje.');
      }
    } catch (error) {
      this.logger.error('Erro ao realizar a limpeza avançada:', error);
    }
  }

  async cleanObsoleteCandidatures(idPedido: string) {
    try {
      const deleted = await this.prisma.notification.deleteMany({
        where: {
          id_pedido: idPedido,
          status: 'NEW_CANDIDATURE',
        },
      });

      if (deleted.count > 0) {
        this.logger.log(
          `Limpeza Reativa: ${deleted.count} notificações de NEW_CANDIDATURE removidas para o pedido ${idPedido}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Erro na limpeza reativa do pedido ${idPedido}:`,
        error,
      );
    }
  }
}
