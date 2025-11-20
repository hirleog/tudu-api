// src/notification/notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { WApiService } from 'src/wapi/service/wapi.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wApiService: WApiService,
  ) {}

  /**
   * Envia notificação de card criado com sucesso
   */
  async enviarNotificacaoCardCriado(card: any): Promise<void> {
    try {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: card.id_cliente },
        select: { telefone: true, nome: true },
      });

      if (!cliente?.telefone) {
        this.logger.warn(
          `Cliente ${card.id_cliente} não tem telefone cadastrado`,
        );
        return;
      }

      const mensagem = this.formatarMensagemCardCriado(card, cliente.nome);

      const payload = {
        phone: cliente.telefone,
        message: mensagem,
        delayMessage: 10,
      };

      await this.wApiService.sendMessage(payload);
      this.logger.log(`Notificação WhatsApp enviada para ${cliente.telefone}`);
    } catch (error) {
      this.logger.error(
        'Erro ao enviar WhatsApp de card criado:',
        error.message,
      );
    }
  }

  /**
   * Envia notificação de nova candidatura
   */
  async enviarNotificacaoNovaCandidatura(
    idCliente: number,
    idPedido: string,
    prestador: any,
    candidaturaDto: any,
  ): Promise<void> {
    try {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id_cliente: idCliente },
        select: { telefone: true, nome: true },
      });

      if (!cliente?.telefone) {
        this.logger.warn(
          `Cliente ${idCliente} não tem telefone para notificação de candidatura`,
        );
        return;
      }

      const mensagem = this.formatarMensagemNovaCandidatura(
        idPedido,
        prestador,
        candidaturaDto,
        cliente.nome,
      );

      const payload = {
        phone: cliente.telefone,
        message: mensagem,
        delayMessage: 10,
      };

      await this.wApiService.sendMessage(payload);
      this.logger.log(
        `📨 Notificação de candidatura enviada para ${cliente.nome}`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Erro ao enviar WhatsApp de candidatura:',
        error.message,
      );
    }
  }

  /**
   * Envia notificação genérica
   */
  async enviarNotificacaoGenerica(
    telefone: string,
    mensagem: string,
  ): Promise<void> {
    try {
      const payload = {
        phone: telefone,
        message: mensagem,
        delayMessage: 10,
      };

      await this.wApiService.sendMessage(payload);
      this.logger.log(`Notificação genérica enviada para ${telefone}`);
    } catch (error) {
      this.logger.error('Erro ao enviar notificação genérica:', error.message);
    }
  }

  /**
   * Formata mensagem de card criado
   */
  private formatarMensagemCardCriado(card: any, nomeCliente: string): string {
    return `✅ *SEU PEDIDO FOI CRIADO COM SUCESSO!*

👤 *Cliente:* ${nomeCliente}
📦 *Pedido:* #${card.id_pedido}
🗂️ *Categoria:* ${card.categoria}
📋 *Serviço:* ${card.serviceDescription}
💵 *Valor:* R$ ${card.valor}
📍 *Local:* ${card.street}, ${card.number} - ${card.neighborhood}
🏙️ *Cidade:* ${card.city}/${card.state}

⏰ *Horário Preferencial:* ${card.horario_preferencial}

🔢 *Código de Confirmação:* ${card.codigo_confirmacao}

_Status do pedido: ${card.status_pedido}_

Obrigado por utilizar nossos serviços!`;
  }

  /**
   * Formata mensagem de nova candidatura
   */
  private formatarMensagemNovaCandidatura(
    idPedido: string,
    prestador: any,
    candidaturaDto: any,
    nomeCliente: string,
  ): string {
    const baseUrl =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:4200'
        : 'https://use-tudu.com.br';

    const linkProposta = `${baseUrl}/home/budgets?id=${idPedido}&flow=publicado`;

    return `🎯 *NOVA PROPOSTA RECEBIDA!*

Olá ${nomeCliente}! Você recebeu uma nova proposta para seu pedido #${idPedido}.

💰 *Valor Proposto:* R$ ${candidaturaDto.valor_negociado}
⏰ *Horário Sugerido:* ${candidaturaDto.horario_negociado}

📱 *ACESSE A PROPOSTA:*
${linkProposta}

💡 *Próximos passos:*
• Clique no link acima para ver detalhes
• Compare com outras propostas  
• Aceite a que melhor atende suas necessidades

_Estamos torcendo pelo melhor match!_`;
  }
}
