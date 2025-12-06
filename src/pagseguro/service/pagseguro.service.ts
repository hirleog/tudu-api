import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CreatePixQrCodeDto } from '../dto/create-pix-qrcode.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AxiosRequestConfig } from 'axios';
import * as https from 'https';

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
  ) {
    this.initializeConfig();
  }

  private initializeConfig() {
    this.config = {
      sandbox: this.configService.get<boolean>('PAGBANK_SANDBOX', true),
      // ✅ AGORA APENAS O TOKEN DIRETO
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
        tax_id: this.config.sandbox
          ? '12345678909'
          : card.Cliente.cpf || '12345678909',
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
          unit_amount: card.valor, // Centavos
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

    console.log('📤 Criando pedido PIX:', {
      reference: payload.reference_id,
      amount: `R$ ${(payload.qr_codes[0].amount.value / 100).toFixed(2)}`,
      customer: payload.customer.email,
      url: `${baseUrl}/orders`,
    });

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
   * Cancelar pedido
   */
  async cancelOrder(orderId: string): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const headers = await this.getHeaders();

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/orders/${orderId}/cancel`,
          {},
          {
            headers,
            timeout: 10000,
          },
        ),
      );

      // Atualiza status no banco
      await this.prisma.pagamento.updateMany({
        where: { charge_id: orderId },
        data: {
          status: 'cancelled',
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      this.logger.error(
        'Erro ao cancelar pedido:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Verificar configurações de ambiente
   */
  async checkEnvironment(): Promise<any> {
    const envVars = {
      PAGBANK_API_KEY: {
        exists: !!this.configService.get<string>('PAGBANK_API_KEY'),
        length: this.configService.get<string>('PAGBANK_API_KEY')?.length || 0,
      },
      PAGBANK_APP_ID: {
        exists: !!this.configService.get<string>('PAGBANK_APP_ID'),
        value: this.configService.get<string>('PAGBANK_APP_ID'),
      },
      PAGBANK_PUBLIC_KEY: {
        exists: !!this.configService.get<string>('PAGBANK_PUBLIC_KEY'),
        length:
          this.configService.get<string>('PAGBANK_PUBLIC_KEY')?.length || 0,
      },
      PAGBANK_SANDBOX: this.configService.get<boolean>('PAGBANK_SANDBOX', true),
      PAGBANK_WEBHOOK_URL: this.configService.get<string>(
        'PAGBANK_WEBHOOK_URL',
      ),
    };

    return {
      success: true,
      environment: envVars,
      currentConfig: {
        sandbox: this.config.sandbox,
        hasAppKey: !!this.config.appKey,
        hasAccessToken: !!this.accessToken,
      },
    };
  }
}
