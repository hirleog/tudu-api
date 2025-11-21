// src/notification/notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { WApiService } from 'src/wapi/service/wapi.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ButtonActionDto } from 'src/wapi/dto/send-message.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wApiService: WApiService,
  ) {}

  /**
   * Envia notificação de card criado com sucesso COM BOTÕES
   */
  async enviarNotificacaoCardCriadoComBotoes(card: any): Promise<void> {
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
      const buttonActions = this.criarBotoesCardCriado(card);

      const payload = {
        phone: cliente.telefone,
        message: mensagem,
        buttonActions,
        delayMessage: 10,
      };

      await this.wApiService.sendButtonActions(payload);
      this.logger.log(
        `Notificação WhatsApp com botões enviada para ${cliente.telefone}`,
      );
    } catch (error) {
      this.logger.error(
        'Erro ao enviar WhatsApp com botões de card criado:',
        error.message,
      );
    }
  }

  /**
   * Envia notificação de nova candidatura COM BOTÕES
   */
  async enviarNotificacaoNovaCandidaturaComBotoes(
    idCliente: number,
    idPedido: string,
    prestador: any,
    candidaturaDto: any,
    cardDTO: any,
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
        cardDTO,
      );

      const buttonActions = this.criarBotoesNovaCandidatura(idPedido);

      const payload = {
        phone: cliente.telefone,
        message: mensagem,
        buttonActions,
        delayMessage: 10,
      };

      await this.wApiService.sendButtonActions(payload);
      this.logger.log(
        `📨 Notificação de candidatura com botões enviada para ${cliente.nome}`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Erro ao enviar WhatsApp com botões de candidatura:',
        error.message,
      );
    }
  }

  /**
   * Envia notificação genérica com botões
   */
  async enviarNotificacaoComBotoes(
    telefone: string,
    mensagem: string,
    buttonActions: ButtonActionDto[],
  ): Promise<void> {
    try {
      const payload = {
        phone: telefone,
        message: mensagem,
        buttonActions,
        delayMessage: 10,
      };

      await this.wApiService.sendButtonActions(payload);
      this.logger.log(`Notificação com botões enviada para ${telefone}`);
    } catch (error) {
      this.logger.error(
        'Erro ao enviar notificação com botões:',
        error.message,
      );
    }
  }

  /**
   * Cria botões para notificação de card criado
   */
  private criarBotoesCardCriado(card: any): ButtonActionDto[] {
    const baseUrl =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:4200'
        : 'https://use-tudu.com.br';

    return [
      {
        type: 'URL' as const,
        buttonText: '📱 Acessar Pedido',
        url: `${baseUrl}/home/budgets?id=${card.id_pedido}&flow=publicado`,
      },
      //   {
      //     type: 'CALL' as const,
      //     buttonText: '📞 Falar com Suporte',
      //     phone: '+559992249708', // Substitua pelo telefone do suporte
      //   },
      //   {
      //     type: 'REPLAY' as const,
      //     buttonText: '💬 Tirar Dúvidas',
      //   },
    ];
  }

  /**
   * Cria botões para notificação de nova candidatura
   */
  private criarBotoesNovaCandidatura(idPedido: string): ButtonActionDto[] {
    const baseUrl =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:4200'
        : 'https://use-tudu.com.br';

    return [
      {
        type: 'URL' as const,
        buttonText: '👀 Ver Proposta',
        url: `${baseUrl}/home/budgets?id=${idPedido}&flow=publicado`,
      },
    ];
  }

  /**
   * Formata mensagem de card criado (mantido igual)
   */
  private formatarMensagemCardCriado(card: any, nomeCliente: string): string {
    return `✅ *SEU PEDIDO FOI CRIADO COM SUCESSO!*

📦 *Pedido:* #${card.id_pedido}
🗂️ *Categoria:* ${card.categoria}
💵 *Valor:* R$ ${card.valor}
⏰ *Data:* ${card.horario_preferencial.replace('-', '/').replace(' ', ' - ')}
📍 *Local:* ${card.street}, ${card.number} - ${card.neighborhood}

🔢 *Código de Confirmação:* ${card.codigo_confirmacao}

Obrigado por utilizar nossos serviços!`;
  }

  /**
   * Formata mensagem de nova candidatura (mantido igual)
   */
  private formatarMensagemNovaCandidatura(
    idPedido: string,
    prestador: any,
    candidaturaDto: any,
    nomeCliente: string,
    cardDTO: any,
  ): string {
    return `🎯 *NOVA PROPOSTA RECEBIDA!*

🗂️ *Categoria:* ${cardDTO.categoria}
💰 *Valor Proposto:* R$ ${candidaturaDto.valor_negociado}
⏰ *Horário Sugerido:* ${candidaturaDto.horario_negociado.replace('-', '/').replace(' ', ' - ')}`;
  }
}
