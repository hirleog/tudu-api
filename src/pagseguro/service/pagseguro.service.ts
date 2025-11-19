import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CreatePixOrderDto } from '../dto/create-pix-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AxiosRequestConfig } from 'axios';
import * as https from 'https';

@Injectable()
export class PagSeguroService {
  private readonly logger = new Logger(PagSeguroService.name);
  private config: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    // ✅ CORREÇÃO: Inicializar config no construtor
    this.initializeConfig();
  }

  private getHttpConfig(): AxiosRequestConfig {
    const config = this.getConfig();

    return {
      timeout: 30000,
      // ✅ Configuração SSL para desenvolvimento
      httpsAgent: config.sandbox
        ? new https.Agent({ rejectUnauthorized: false }) // ⚠️ Sandbox
        : new https.Agent({ rejectUnauthorized: true }), // ✅ Produção
    };
  }

  private initializeConfig() {
    this.config = {
      apiKey: this.configService.get<string>('PAGBANK_API_KEY'),
      sandbox: this.configService.get<boolean>('PAGSEGURO_SANDBOX', true),
    };

    console.log('🔐 CONFIGURAÇÕES INICIALIZADAS:', {
      hasApiKey: !!this.config.apiKey,
      apiKeyLength: this.config.apiKey?.length,
      apiKeyPrefix: this.config.apiKey?.substring(0, 10) + '...',
      sandbox: this.config.sandbox,
    });
  }

  private getConfig() {
    // ✅ CORREÇÃO: Retornar config já inicializada
    return this.config;
  }

  private getBaseUrl(): string {
    const config = this.getConfig();
    const baseUrl = config.sandbox
      ? 'https://sandbox.api.pagbank.com.br'
      : 'https://api.pagbank.com.br';

    console.log('🌐 URL BASE:', baseUrl);
    return baseUrl;
  }

  private getHeaders() {
    const config = this.getConfig();

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      // PagBank usa versão 1.0 da API, não 4.0
      'x-api-version': '1.0', // ← CORRIGIDO!
    };

    console.log('📨 HEADERS:', {
      Authorization: headers.Authorization ? 'Bearer ***' : 'MISSING',
      'x-api-version': headers['x-api-version'],
      'Content-Type': headers['Content-Type'],
    });

    return headers;
  }

  async testAuthentication(): Promise<any> {
    try {
      const baseUrl = this.config.sandbox
        ? 'https://sandbox.pagbank.com.br'
        : 'https://api.pagbank.com.br';

      const apiKey = this.config.apiKey;

      console.log('🧪 INICIANDO TESTE DE CONEXÃO');
      console.log(
        '🔐 API Key:',
        apiKey ? `${apiKey.substring(0, 15)}...` : 'NÃO ENCONTRADA',
      );
      console.log('🌐 URL:', baseUrl);

      // Headers simplificados
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'Tudu-Servicos/1.0',
      };

      // ✅ PRIMEIRO: Teste de conectividade básica
      console.log('📡 Testando conectividade básica...');

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/orders`, {
          headers,
          timeout: 10000, // 10 segundos
          // Adicionar configurações para evitar CORS/proxy issues
          withCredentials: false,
        }),
      );

      console.log('✅ CONEXÃO ESTABELECIDA!');
      console.log('📊 Status:', response.status);
      console.log('📦 Dados:', response.data ? 'Recebidos' : 'Vazios');

      return {
        success: true,
        message: 'Conexão com PagBank estabelecida com sucesso',
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      console.error('❌ ERRO DETALHADO:');

      if (error.code) {
        console.error('Código do erro:', error.code);
      }

      if (error.response) {
        // O servidor respondeu com status de erro
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        console.error('Headers:', error.response.headers);

        return {
          success: false,
          error: `Erro ${error.response.status}: ${JSON.stringify(error.response.data)}`,
          type: 'API_ERROR',
        };
      } else if (error.request) {
        // A requisição foi feita mas não houve resposta
        console.error('Request:', error.request);
        console.error('No response received');

        // Teste de DNS e conectividade
        await this.testNetworkConnectivity();

        return {
          success: false,
          error:
            'Sem resposta do servidor PagBank. Verifique:\n1. Conexão com internet\n2. Firewall/Proxy\n3. DNS',
          type: 'NETWORK_ERROR',
        };
      } else {
        // Outro erro
        console.error('Error message:', error.message);

        return {
          success: false,
          error: error.message,
          type: 'UNKNOWN_ERROR',
        };
      }
    }
  }

  // Método para testar conectividade de rede
  private async testNetworkConnectivity(): Promise<void> {
    console.log('🌐 TESTANDO CONECTIVIDADE DE REDE...');

    const testUrls = [
      'https://api.sandbox.pagbank.com.br',
      'https://google.com',
      'https://github.com',
    ];

    for (const url of testUrls) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(url, { timeout: 5000 }),
        );
        console.log(`✅ ${url}: Conectável (${response.status})`);
      } catch (error) {
        console.log(`❌ ${url}: Não conectável - ${error.message}`);
      }
    }
  }
  async createSimplePixCharge(createPixChargeDto: {
    reference_id: string;
    description: string;
    value: number;
    customer_name: string;
    customer_email?: string;
    customer_tax_id?: string;
    expires_in_minutes?: number;
  }): Promise<any> {
    const amountInCents = Math.round(createPixChargeDto.value * 100);
    const expiresInSeconds = (createPixChargeDto.expires_in_minutes || 30) * 60;

    // ✅ CORREÇÃO: Usar email sandbox se estiver em ambiente de teste
    const config = this.getConfig();
    let customerEmail = createPixChargeDto.customer_email;

    if (config.sandbox && customerEmail) {
      // Gera email sandbox baseado no ID do pedido ou email original
      const sandboxSuffix = '@sandbox.pagseguro.com.br';

      if (
        createPixChargeDto.customer_email?.includes('@sandbox.pagseguro.com.br')
      ) {
        // Já é um email sandbox, mantém
        customerEmail = createPixChargeDto.customer_email;
      } else {
        // Cria email sandbox baseado no reference_id
        const prefix = 'c'; // 'c' para comprador
        const cleanId = createPixChargeDto.reference_id
          .replace(/\D/g, '')
          .substring(0, 9);
        customerEmail = `${prefix}${cleanId}${sandboxSuffix}`;
      }
    }

    const pixOrderData: CreatePixOrderDto = {
      reference_id: createPixChargeDto.reference_id,
      customer: {
        name: createPixChargeDto.customer_name,
        email: customerEmail, // ✅ Agora com email sandbox
        tax_id: createPixChargeDto.customer_tax_id,
      },
      items: [
        {
          reference_id: createPixChargeDto.reference_id,
          name: createPixChargeDto.description.substring(0, 256),
          quantity: 1,
          unit_amount: amountInCents,
        },
      ],
      payment_method: {
        type: 'pix',
        pix: {
          expires_in: expiresInSeconds,
          additional_information: [
            {
              name: 'Descrição',
              value: createPixChargeDto.description.substring(0, 256),
            },
          ],
        },
      },
      notification_urls: this.configService.get<string>('PAGBANK_WEBHOOK_URL')
        ? [this.configService.get<string>('PAGBANK_WEBHOOK_URL')]
        : [],
    };

    console.log('📧 EMAIL UTILIZADO:', {
      original: createPixChargeDto.customer_email,
      sandbox: customerEmail,
      environment: config.sandbox ? 'SANDBOX' : 'PRODUÇÃO',
    });
    try {
      // Chama o método createPixOrder existente
      const result = await this.createPixOrder(pixOrderData);

      if (!result.success) {
        throw new Error(result.message || 'Erro ao criar pedido PIX');
      }

      // ... resto do código permanece igual
      const orderData = result.data.order;
      const localPaymentId = result.data.local_payment_id;

      const charge = orderData.charges?.[0];
      const pixInfo = charge?.payment_method?.pix;
      const qrCode = pixInfo?.qr_codes?.[0];

      const formattedResponse = {
        success: true,
        data: {
          id: orderData.id,
          reference_id: orderData.reference_id,
          local_payment_id: localPaymentId,
          status: orderData.status,
          qr_code: qrCode?.text,
          qr_code_image: qrCode?.image,
          amount: {
            value:
              charge?.amount?.value || orderData.charges?.[0]?.amount?.value,
            currency: charge?.amount?.currency || 'BRL',
          },
          created_at: orderData.created_at,
          expiration_date:
            pixInfo?.expires_at ||
            orderData.charges?.[0]?.payment_method?.pix?.expires_at,
          payment_method: {
            type: 'pix',
            pix: {
              encrypted_value: qrCode?.text,
              qr_code: qrCode?.text,
              qr_code_image: qrCode?.image,
              expiration_date:
                pixInfo?.expires_at ||
                orderData.charges?.[0]?.payment_method?.pix?.expires_at,
            },
          },
          _full_order: orderData,
        },
        message: 'Cobrança PIX criada com sucesso',
      };

      this.logger.log(
        `PIX simplificado criado: ${createPixChargeDto.reference_id}`,
      );
      return formattedResponse;
    } catch (error) {
      this.logger.error('Erro ao criar PIX simplificado:', error);
      throw new Error(error.message || 'Erro ao processar cobrança PIX');
    }
  }
  async createPixOrder(createPixOrderDto: CreatePixOrderDto): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const headers = this.getHeaders();
    const httpConfig = this.getHttpConfig();

    console.log('🔐 CONFIGURAÇÃO SSL:', {
      sandbox: this.getConfig().sandbox,
      rejectUnauthorized: httpConfig.httpsAgent?.options?.rejectUnauthorized,
    });

    try {
      // TESTE DE CONEXÃO PRIMEIRO
      console.log('🔍 TESTANDO CONEXÃO...');

      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/orders`, createPixOrderDto, {
          headers,
          ...httpConfig, // ✅ Aplica configuração SSL
        }),
      );

      console.log('✅ RESPOSTA RECEBIDA:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      });

      const orderData = response.data;

      // SALVA NO BANCO
      const pagamento = await this.prisma.pagamento.create({
        data: {
          id_pedido: createPixOrderDto.reference_id,
          charge_id: orderData.id,
          reference_id: orderData.reference_id,
          total_amount: orderData.charges[0]?.amount?.value || 0,
          origin_amount: orderData.charges[0]?.amount?.value || 0,
          status: this.mapStatus(orderData.charges[0]?.status || 'CREATED'),
          type: 'pix',
          host: 'pagbank',
          qr_code:
            orderData.charges[0]?.payment_method?.pix?.qr_codes?.[0]?.text ||
            orderData.qr_codes?.[0]?.text,
          qr_code_image:
            orderData.charges[0]?.payment_method?.pix?.qr_codes?.[0]?.image ||
            orderData.qr_codes?.[0]?.links?.[0]?.href,
          expiration_date: new Date(
            orderData.charges[0]?.payment_method?.pix?.expires_at ||
              orderData.expiration_date,
          ),
          response_description: orderData.charges[0]?.payment_response?.message,
        },
      });

      console.log('💾 PAGAMENTO SALVO NO BANCO:', pagamento.id);

      return {
        success: true,
        data: {
          order: orderData,
          local_payment_id: pagamento.id,
        },
      };
    } catch (error) {
      console.error('❌ ERRO COMPLETO:', error);

      // CAPTURA TODOS OS TIPOS DE ERRO POSSÍVEIS
      let errorMessage = 'Erro desconhecido';

      if (error.response) {
        // Erro da API do PagBank
        console.error('📡 ERRO DA API PAGBANK:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
        });

        errorMessage = `PagBank ${error.response.status}: ${error.response.statusText} - ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        // Erro de rede - requisição foi feita mas não houve resposta
        console.error('🌐 ERRO DE REDE:', error.request);
        errorMessage = 'Sem resposta do servidor PagBank - verifique conexão';
      } else if (error.code) {
        // Erro do Axios/HTTP
        console.error('🔌 ERRO HTTP:', error.code, error.message);
        errorMessage = `Erro HTTP ${error.code}: ${error.message}`;
      } else {
        // Erro genérico
        console.error('⚡ ERRO GENÉRICO:', error.message);
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  }
  /**
   * Consultar pedido
   */
  async getOrder(orderId: string): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const headers = this.getHeaders();

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/orders/${orderId}`, { headers }),
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('Erro ao consultar pedido:', error.response?.data);
      throw error;
    }
  }

  /**
   * Cancelar pedido
   */
  async cancelOrder(orderId: string): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const headers = this.getHeaders();

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${baseUrl}/orders/${orderId}/cancel`,
          {},
          { headers },
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
    } catch (error) {
      this.logger.error('Erro ao cancelar pedido:', error.response?.data);
      throw error;
    }
  }

  private mapStatus(status: string): string {
    const statusMap = {
      PAID: 'paid',
      CANCELED: 'cancelled',
      EXPIRED: 'expired',
      CREATED: 'pending',
      WAITING: 'pending',
      IN_ANALYSIS: 'pending',
    };

    return statusMap[status] || 'pending';
  }

  async checkEnvironment(): Promise<any> {
    const envVars = {
      PAGBANK_API_KEY: {
        exists: !!this.configService.get<string>('PAGBANK_API_KEY'),
        value: this.configService.get<string>('PAGBANK_API_KEY')
          ? this.configService.get<string>('PAGBANK_API_KEY').substring(0, 10) +
            '...'
          : 'NOT FOUND',
        length: this.configService.get<string>('PAGBANK_API_KEY')?.length || 0,
      },
      PAGBANK_SANDBOX: this.configService.get<boolean>('PAGBANK_SANDBOX', true),
      PAGBANK_WEBHOOK_URL: this.configService.get<string>(
        'PAGBANK_WEBHOOK_URL',
      ),
    };

    console.log('🔍 VARIÁVEIS DE AMBIENTE:', envVars);

    return {
      success: true,
      environment: envVars,
    };
  }
}
