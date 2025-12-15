import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CreatePixQrCodeDto } from '../dto/create-pix-qrcode.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AxiosRequestConfig } from 'axios';
import * as https from 'https';
import { EventsGateway } from 'src/events/events.gateway';
import { NotificationsService } from 'src/notifications/service/notifications.service';

@Injectable()
export class PagSeguroService {
  private readonly logger = new Logger(PagSeguroService.name);
  private config: any;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private oauthToken: string | null = null;
  private publicKey: string | null = null;
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {
    this.initializeConfig();
  }

  private initializeConfig() {
    const sandboxEnvValue = this.configService.get<string>(
      'PAGBANK_SANDBOX',
      'true',
    );
    const isSandbox = sandboxEnvValue.toLowerCase() === 'true';

    this.config = {
      sandbox: isSandbox, // ✅ AGORA APENAS O TOKEN DIRETO
      apiToken: this.configService.get<string>('PAGBANK_API_TOKEN'),
      // Pode manter a chave pública se quiser (mas não é mais obrigatória)
      publicKey: this.configService.get<string>('PAGBANK_PUBLIC_KEY'),
    };

    console.log('🔐 CONFIGURAÇÕES NOVAS:', {
      sandbox: this.config.sandbox,
      hasToken: !!this.config.apiToken,
      tokenPrefix: this.config.apiToken?.substring(0, 15) + '...',
      hasPublicKey: !!this.config.publicKey,
    });

    // Se tiver chave pública, usar
    if (this.config.publicKey) {
      this.publicKey = this.config.publicKey;
    }
  }

  private getBaseUrl(): string {
    // ✅ URLs CORRETAS confirmadas
    return this.config.sandbox
      ? 'https://sandbox.api.pagseguro.com'
      : 'https://api.pagseguro.com';
  }

  private getHttpConfig(): AxiosRequestConfig {
    return {
      timeout: 30000,
      httpsAgent: this.config.sandbox
        ? new https.Agent({ rejectUnauthorized: false })
        : new https.Agent({ rejectUnauthorized: true }),
    };
  }

  /**
   * ✅ Headers SIMPLIFICADOS - Token direto
   */
  private getHeaders(): any {
    const headers: any = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiToken}`, // ✅ Token direto!
      'x-api-version': '4.0',
      accept: 'application/json',
    };

    // Chave pública é opcional agora, mas pode ajudar
    if (this.publicKey) {
      headers['x-public-key'] = this.publicKey;
    }

    console.log('📨 Headers sendo enviados:', {
      auth: headers.Authorization?.substring(0, 20) + '...',
      hasPublicKey: !!headers['x-public-key'],
      apiVersion: headers['x-api-version'],
    });

    return headers;
  }

  /**
   * ✅ Criar pedido PIX - VERSÃO SIMPLIFICADA
   */
  async createPixOrder(createPixQrCodeDto: CreatePixQrCodeDto): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const headers = this.getHeaders();
    const httpConfig = this.getHttpConfig();

    // Buscar dados do banco
    const card = await this.prisma.card.findUnique({
      where: { id_pedido: createPixQrCodeDto.reference_id },
      include: { Cliente: true },
    });

    if (!card) {
      throw new Error('Pedido não encontrado');
    }

    const cleanTaxId = card.Cliente.cpf.replace(/\D/g, '');
    // ✅ PAYLOAD CORRETO para PagBank
    const payload = {
      reference_id: createPixQrCodeDto.reference_id,
      customer: {
        name: `${card.Cliente.nome} ${card.Cliente.sobrenome}`.substring(
          0,
          100,
        ),
        email: this.config.sandbox
          ? `c${createPixQrCodeDto.reference_id.replace(/\D/g, '').padEnd(9, '0').substring(0, 9)}@sandbox.pagseguro.com.br`
          : card.Cliente.email,
        tax_id: cleanTaxId,
        phones: [
          {
            country: '55',
            area: card.Cliente.telefone?.substring(0, 2) || '11',
            number: card.Cliente.telefone?.substring(2) || '999999999',
            type: 'MOBILE',
          },
        ],
      },
      items: [
        {
          name: `Serviço: ${card.categoria} - ${card.subcategoria}`.substring(
            0,
            100,
          ),
          quantity: 1,
          unit_amount: createPixQrCodeDto.totalWithTax, // Centavos
        },
      ],
      qr_codes: [
        {
          amount: {
            value: createPixQrCodeDto.totalWithTax, // Centavos
          },
        },
      ],
      notification_urls: this.configService.get<string>('PAGBANK_WEBHOOK_URL')
        ? [this.configService.get<string>('PAGBANK_WEBHOOK_URL')]
        : [],
    };

    console.log('Payload completo:', JSON.stringify(payload, null, 2));
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/orders`, payload, {
          headers,
          ...httpConfig,
        }),
      );

      const orderData = response.data;
      const qrCodeData = orderData.qr_codes?.[0];

      // Salvar no banco
      const pagamento = await this.prisma.pagamento.create({
        data: {
          id_pagamento: orderData.id,
          id_pedido: createPixQrCodeDto.reference_id,
          charge_id: orderData.id,
          reference_id: orderData.reference_id,
          total_amount: qrCodeData?.amount?.value,
          origin_amount: Math.round(Number(card.valor) * 100),
          status: 'pending',
          type: 'pix',
          host: 'pagbank',
          qr_code_image: qrCodeData?.links?.[0]?.href || '', // URL como string
          expiration_date: new Date(
            qrCodeData?.expiration_date || Date.now() + 24 * 60 * 60 * 1000,
          ),
        },
      });

      return {
        success: true,
        message: 'Pedido PIX criado com sucesso',
        data: {
          // Resposta completa do PagBank
          pagbank_response: orderData,

          // Dados formatados para fácil acesso
          order: {
            id: orderData.id,
            reference_id: orderData.reference_id,
            status: orderData.status,
            created_at: orderData.created_at,
          },

          qr_code: {
            id: qrCodeData?.id,
            amount: qrCodeData?.amount,
            expiration_date: qrCodeData?.expiration_date,
            text: qrCodeData?.text,
            image_url: qrCodeData?.links?.[0]?.href,
            links: qrCodeData?.links || [],
          },

          // Seus dados locais
          local_data: {
            payment_id: pagamento.id,
            database_id: pagamento.id,
            saved_at: pagamento.created_at,
          },
        },
      };
    } catch (error: any) {
      console.error('❌ ERRO detalhado:', {
        status: error.response?.status,
        data: error.response?.data,
        url: `${baseUrl}/orders`,
      });
      console.log('payload: ', JSON.stringify(payload, null, 2));

      // Mensagens de erro específicas
      let userMessage = 'Erro ao criar pedido PIX';

      if (error.response?.status === 401) {
        userMessage = 'Token de autenticação inválido ou expirado';
      } else if (error.response?.status === 403) {
        userMessage = 'Acesso negado. Verifique permissões do token';
      } else if (error.response?.status === 400) {
        userMessage = `Dados inválidos: ${JSON.stringify(error.response.data)}`;
      } else if (error.response?.data?.message) {
        userMessage = error.response.data.message;
      }

      throw new Error(userMessage);
    }
  }
  /**
   * Consultar pedido por ID
   */
  async getOrder(orderId: string): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const headers = await this.getHeaders();

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/orders/${orderId}`, {
          headers,
          timeout: 10000,
        }),
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      this.logger.error(
        'Erro ao consultar pedido:',
        error.response?.data || error.message,
      );

      if (error.response?.status === 404) {
        throw new Error('Pedido não encontrado no PagBank');
      }

      throw error;
    }
  }

  /**
   * Cancelar pedido (Estorno total ou parcial)
   */
  async cancelOrder(
    paymentId: string,
    payload: { amount?: number },
  ): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const headers = await this.getHeaders();
    const url = `${baseUrl}/payments/${paymentId}/refunds`;

    let pagamentoOriginal: any | null = null;
    let amountInCents: number;

    const prefix = 'ORDER_';
    const paymentIdFormat = paymentId.replace(prefix, '');

    try {
      pagamentoOriginal = await this.prisma.pagamento.findFirst({
        where: { id_pagamento: paymentIdFormat },
      });

      if (!pagamentoOriginal) {
        throw new Error(
          `Pagamento não encontrado no banco de dados para o ID: ${paymentIdFormat}`,
        );
      }

      // Lógica para determinar o valor do estorno:
      // Se 'payload.amount' for fornecido (valor em BRL), usamos ele (para estorno parcial).
      // Se não for fornecido, usamos o 'total_amount' do BD (para estorno total).
      if (payload.amount) {
        // Converte o valor em BRL (vindo do front) para centavos
        amountInCents = payload.amount;

        // Verificação opcional: não permitir estorno de valor maior que o original
        if (amountInCents > pagamentoOriginal.total_amount) {
          throw new Error(
            'O valor do estorno não pode exceder o valor original do pagamento.',
          );
        }
      } else {
        // Estorno total: usa o valor armazenado em centavos no DB
        amountInCents = pagamentoOriginal.total_amount;
      }
    } catch (dbError) {
      this.logger.error(
        'Erro ao buscar pagamento no banco de dados antes do estorno:',
        dbError,
      );
      throw new HttpException(
        'Erro interno: Não foi possível obter os dados do pagamento original.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const pagbankPayload = {
      amount: {
        value: amountInCents,
        currency: 'BRL',
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, pagbankPayload, { headers, timeout: 30000 }),
      );

      // Atualiza o banco de dados após sucesso
      try {
        await this.prisma.pagamento.update({
          where: { id: pagamentoOriginal.id },
          data: {
            status: 'voided', // Considera 'voided' mesmo para parcial, mas você pode querer 'partially_refunded'
            reversed_amount: amountInCents,
            updated_at: new Date(),
          },
        });
      } catch (dbError) {
        this.logger.error(
          'Erro ao atualizar o banco de dados após estorno PagBank:',
          dbError,
        );
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      this.logger.error(
        'Erro ao estornar pagamento PIX no PagBank:',
        error.response?.data || error.message,
      );
      throw new HttpException(
        error.response?.data?.error_messages?.join(' | ') ||
          error.response?.data?.message ||
          'Erro ao estornar pagamento PIX',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async handlePagBankWebhook(
    webhookData: any,
    signature: string,
    notificationId: string,
  ): Promise<void> {
    const orderId = webhookData.id;
    const referenceId = webhookData.reference_id;

    // O status pode vir no campo 'status' do Order (Checkout) ou 'chargeStatus' do Charge (Transacional)
    const status = webhookData.status;
    const charge = webhookData.charges?.[0];
    const chargeStatus = charge?.status;

    // Priorizamos o status da cobrança (chargeStatus) se existir,
    // pois ele é mais granular para o evento transacional.
    const effectiveStatus = chargeStatus || status;

    // Mapeamento dos status do PagBank para os status do seu banco de dados (Prisma)
    let finalStatus:
      | 'paid'
      | 'pending'
      | 'cancelled'
      | 'declined'
      | 'expired'
      | 'in_analysis';
    let logMessage: string;
    let notifyFrontend: boolean = true;

    // --- Lógica de Decisão e Mapeamento de Status ---

    switch (effectiveStatus) {
      case 'PAID':
        finalStatus = 'paid';
        logMessage = `✅ Pagamento ${referenceId} (${orderId}) marcado como PAGO via webhook.`;
        break;

      case 'IN_ANALYSIS':
        finalStatus = 'in_analysis';
        logMessage = `⚠️ Pagamento ${referenceId} (${orderId}) em ANÁLISE de risco.`;
        break;

      case 'DECLINED':
        finalStatus = 'declined';
        logMessage = `❌ Pagamento ${referenceId} (${orderId}) foi REJEITADO (Declined).`;
        break;

      case 'CANCELLED':
        finalStatus = 'cancelled';
        logMessage = `🛑 Pagamento ${referenceId} (${orderId}) foi CANCELADO.`;
        break;

      case 'WAITING':
        // Se o PagBank enviar 'WAITING' (transacional), mantemos como 'pending'.
        finalStatus = 'pending';
        logMessage = `⏳ Pagamento ${referenceId} (${orderId}) AGUARDANDO pagamento.`;
        // Não precisa notificar o front se o status já era pending
        notifyFrontend = false;
        break;

      case 'EXPIRED':
        // Webhook de Checkout: Expiração do link/checkout
        finalStatus = 'expired';
        logMessage = `⌛ Checkout ${referenceId} (${orderId}) EXPIROU (tempo limite excedido).`;
        break;

      default:
        // Lidar com status desconhecidos ou inicial (e.g., CREATED)
        this.logger.warn(
          `Webhook recebido com status desconhecido/ignorado: ${effectiveStatus}`,
        );
        return; // Sai do método sem atualizar ou notificar
    }

    // --- Lógica de Atualização do DB ---

    // 1. Buscar o Card para obter o Cliente ID.
    const card = await this.prisma.card.findUnique({
      where: { id_pedido: referenceId },
      select: { id_cliente: true }, // <--- CORREÇÃO: Seleciona a FK diretamente
    });
    // 2. Atualizar DB (Apenas se o status for diferente do atual no DB, para evitar escritas desnecessárias)
    const updateResult = await this.prisma.pagamento.updateMany({
      where: { reference_id: referenceId, status: { not: finalStatus } },
      data: {
        status: finalStatus,
        // Apenas PAID tem o paid_at
        paid_at:
          finalStatus === 'paid'
            ? new Date(charge?.paid_at || Date.now())
            : null,
        updated_at: new Date(),
      },
    });

    if (updateResult.count > 0) {
      this.logger.log(logMessage);

      // 🚀 AÇÃO NOVA: NOTIFICAÇÃO DE SUCESSO DE PAGAMENTO
      // Usa card.id_cliente (campo simples)
      if (finalStatus === 'paid' && card?.id_cliente) {
        const amountValue = charge?.amount?.value || webhookData.amount?.value;

        // Verifica se o valor é válido antes de chamar o serviço
        if (amountValue && amountValue > 0) {
          await this.notificationsService.notificarSucessoPagamento(
            card.id_cliente, // <--- CORRIGIDO: Passa o campo simples 'id_cliente'
            referenceId,
            amountValue,
          );
        }
      }
    } else {
      this.logger.debug(
        `Status ${finalStatus} para ${referenceId} já estava no DB ou não encontrado.`,
      );
      // Se o DB já estava no status final e não é o evento 'paid', não precisa notificar o front
      if (finalStatus !== 'paid') {
        notifyFrontend = false;
      }
    }

    // --- Lógica de Notificação do Frontend (WebSocket) ---

    if (notifyFrontend) {
      // 🚀 Notificar o Front via WebSocket
      this.eventsGateway.notifyPaymentSuccess(referenceId, {
        message: this.getFrontendMessage(finalStatus),
        status: finalStatus,
        pagbank_id: orderId,
        amount: charge?.amount?.value || webhookData.amount?.value,
      });
    }

    return;
  }
  /**
   * Método auxiliar para gerar mensagens amigáveis para o Frontend
   */
  private getFrontendMessage(status: string): string {
    switch (status) {
      case 'paid':
        return 'Pagamento PIX confirmado com sucesso!';
      case 'in_analysis':
        return 'Transação em análise de risco.';
      case 'declined':
        return 'Pagamento foi rejeitado. Tente novamente ou use outro método.';
      case 'cancelled':
        return 'Pagamento foi cancelado.';
      case 'expired':
        return 'O tempo para o pagamento PIX expirou.';
      case 'pending':
        return 'Aguardando pagamento.';
      default:
        return 'Status de pagamento atualizado.';
    }
  }
}
