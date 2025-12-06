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

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    this.initializeConfig();
  }

  private async initializeConfig() {
    this.config = {
      sandbox: this.configService.get<boolean>('PAGBANK_SANDBOX', true),
      appId: this.configService.get<string>('PAGBANK_APP_ID'),
      appKey: this.configService.get<string>('PAGBANK_API_KEY'),
      publicKey: this.configService.get<string>('PAGBANK_PUBLIC_KEY'),
      sellerEmail: this.configService.get<string>('PAGBANK_SELLER_EMAIL'),
    };

    console.log('🔐 CONFIGURAÇÕES PAGBANK:', {
      sandbox: this.config.sandbox,
      hasAppId: !!this.config.appId,
      hasAppKey: !!this.config.appKey,
      hasPublicKey: !!this.config.publicKey,
    });

    // Tentar autenticar
    await this.authenticate();
  }

  /**
   * CORREÇÃO: URLs atualizadas do PagBank/PagSeguro
   */
  private getBaseUrl(): string {
    // PagBank/PagSeguro usa estes domínios:
    // Sandbox: https://sandbox.api.pagseguro.com
    // Produção: https://api.pagseguro.com

    // Tente diferentes domínios possíveis
    if (this.config.sandbox) {
      // Tentativa 1: Domínio correto (sem .br)
      return 'https://sandbox.api.pagseguro.com';
      // Alternativa: 'https://sandbox.pagseguro.com'
    } else {
      return 'https://api.pagseguro.com';
    }
  }

  /**
   * CORREÇÃO: URL de autenticação OAuth
   */
  private getOAuthUrl(): string {
    if (this.config.sandbox) {
      return 'https://sandbox.api.pagseguro.com/oauth2/token';
      // Alternativa: 'https://sandbox.pagseguro.com/oauth2/token'
    } else {
      return 'https://api.pagseguro.com/oauth2/token';
    }
  }

  /**
   * Testar diferentes URLs para encontrar a correta
   */
  private async testDomainConnectivity(): Promise<string> {
    const testDomains = [
      'https://sandbox.api.pagseguro.com',
      'https://api.pagbank.com.br', // Domínio antigo
      'https://sandbox.api.pagbank.com.br',
      'https://pagseguro.uol.com.br',
      'https://sandbox.pagseguro.uol.com.br',
    ];

    console.log('🌐 Testando conectividade com domínios...');

    for (const domain of testDomains) {
      try {
        const testUrl = `${domain}/orders`;
        console.log(`Testando: ${testUrl}`);

        const response = await firstValueFrom(
          this.httpService.get(testUrl, {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 5000,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          }),
        );

        console.log(
          `✅ Domínio acessível: ${domain} (Status: ${response.status})`,
        );
        return domain;
      } catch (error: any) {
        console.log(`❌ ${domain}: ${error.code || error.message}`);
      }
    }

    throw new Error('Nenhum domínio do PagBank/PagSeguro está acessível');
  }

  /**
   * Autenticação OAuth 2.0 com URL corrigida
   */
  private async authenticate(): Promise<void> {
    try {
      const authUrl = this.getOAuthUrl();

      console.log('🔐 Tentando autenticar em:', authUrl);

      const authResponse = await firstValueFrom(
        this.httpService.post(
          authUrl,
          new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'payments.read payments.write',
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${this.config.appId}:${this.config.appKey}`).toString('base64')}`,
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            timeout: 10000,
          },
        ),
      );

      this.accessToken = authResponse.data.access_token;
      this.tokenExpiry = new Date(
        Date.now() + authResponse.data.expires_in * 1000,
      );

      console.log('✅ AUTENTICAÇÃO OAuth BEM-SUCEDIDA:', {
        tokenLength: this.accessToken?.length,
        expiresIn: authResponse.data.expires_in,
        tokenType: authResponse.data.token_type,
        scope: authResponse.data.scope,
      });
    } catch (error: any) {
      console.error('❌ ERRO NA AUTENTICAÇÃO OAuth:', {
        url: this.getOAuthUrl(),
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        code: error.code,
      });

      // Fallback: usar AppKey como Bearer Token direto
      console.log('🔄 Usando AppKey como Bearer Token direto...');
      this.accessToken = this.config.appKey;

      // Testar conectividade com domínios
      try {
        const workingDomain = await this.testDomainConnectivity();
        console.log(`✅ Domínio funcionando: ${workingDomain}`);
      } catch (domainError) {
        console.error('❌ Nenhum domínio funcionando');
      }
    }
  }

  /**
   * Obter headers com autenticação
   */
  private async getHeaders(): Promise<any> {
    // Verificar se token expirou (para OAuth)
    if (this.tokenExpiry && new Date() >= this.tokenExpiry) {
      console.log('🔄 Token expirado, renovando...');
      await this.authenticate();
    }

    const headers: any = {
      'Content-Type': 'application/json',
      'x-api-version': '4.0',
      // Algumas APIs exigem este header
      'x-app-id': this.config.appId,
    };

    // Adicionar autorização
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Para APIs específicas do PagBank
    if (this.config.publicKey) {
      headers['x-public-key'] = this.config.publicKey;
    }

    return headers;
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
   * Testar autenticação com diferentes métodos e URLs
   */
  async testAuthentication(): Promise<any> {
    const tests = [];

    // Primeiro testar conectividade básica
    try {
      const workingDomain = await this.testDomainConnectivity();
      tests.push({
        method: 'Conectividade',
        success: true,
        domain: workingDomain,
      });
    } catch (error: any) {
      tests.push({
        method: 'Conectividade',
        success: false,
        error: error.message,
      });
      return {
        success: false,
        tests,
        message: 'Não foi possível conectar a nenhum domínio do PagBank',
      };
    }

    const baseUrl = this.getBaseUrl();

    // Teste 1: Com token atual (OAuth ou Bearer direto)
    try {
      const headers = await this.getHeaders();
      console.log('📤 Testando com headers:', {
        hasAuth: !!headers.Authorization,
        authPrefix: headers.Authorization?.substring(0, 20) + '...',
        xApiVersion: headers['x-api-version'],
        xAppId: headers['x-app-id'],
      });

      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/orders`, {
          headers: headers,
          params: { limit: 1 },
          timeout: 10000,
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        }),
      );
      tests.push({
        method: 'Token Atual',
        success: true,
        status: response.status,
        usedOAuth: this.tokenExpiry !== null,
        url: `${baseUrl}/orders`,
      });
    } catch (error: any) {
      tests.push({
        method: 'Token Atual',
        success: false,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        url: `${baseUrl}/orders`,
      });
    }

    // Teste 2: Bearer Token direto com AppKey
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${baseUrl}/orders`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.appKey}`,
            'x-api-version': '4.0',
            'x-app-id': this.config.appId,
          },
          params: { limit: 1 },
          timeout: 10000,
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        }),
      );
      tests.push({
        method: 'Bearer Direto (AppKey)',
        success: true,
        status: response.status,
        url: `${baseUrl}/orders`,
      });
    } catch (error: any) {
      tests.push({
        method: 'Bearer Direto (AppKey)',
        success: false,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        url: `${baseUrl}/orders`,
      });
    }

    // Teste 3: Com public key
    if (this.config.publicKey) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${baseUrl}/orders`, {
            headers: {
              'Content-Type': 'application/json',
              'x-public-key': this.config.publicKey,
              'x-api-version': '4.0',
              'x-app-id': this.config.appId,
            },
            params: { limit: 1 },
            timeout: 10000,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          }),
        );
        tests.push({
          method: 'Public Key',
          success: true,
          status: response.status,
          url: `${baseUrl}/orders`,
        });
      } catch (error: any) {
        tests.push({
          method: 'Public Key',
          success: false,
          error: error.message,
          status: error.response?.status,
          url: `${baseUrl}/orders`,
        });
      }
    }

    const hasSuccess = tests.some((test) => test.success);

    return {
      success: hasSuccess,
      tests,
      config: {
        sandbox: this.config.sandbox,
        baseUrl,
        appId: this.config.appId,
        appKeyPrefix: this.config.appKey?.substring(0, 10) + '...',
        publicKeyPrefix: this.config.publicKey?.substring(0, 10) + '...',
        hasAccessToken: !!this.accessToken,
        workingDomain: tests.find((t) => t.method === 'Conectividade')?.domain,
      },
      recommendations: hasSuccess
        ? []
        : [
            'Verifique se as credenciais estão corretas',
            'Teste manualmente a URL no navegador ou Postman',
            'Verifique firewall/proxy da rede',
            'O domínio pode ter mudado - consulte a documentação mais recente',
          ],
    };
  }

  /**
   * Criar pedido PIX com QR Code
   */
  async createPixOrder(createPixQrCodeDto: CreatePixQrCodeDto): Promise<any> {
    const baseUrl = this.getBaseUrl();
    const headers = await this.getHeaders();
    const httpConfig = this.getHttpConfig();

    // Buscar dados do banco
    const card = await this.prisma.card.findUnique({
      where: { id_pedido: createPixQrCodeDto.reference_id },
      include: { Cliente: true },
    });

    if (!card) {
      throw new Error('Pedido não encontrado');
    }

    // Preparar payload
    const payload = {
      reference_id: createPixQrCodeDto.reference_id,
      customer: {
        name: `${card.Cliente.nome} ${card.Cliente.sobrenome}`.substring(
          0,
          100,
        ),
        email: card.Cliente.email,
        tax_id: card.Cliente.cpf || '12345678909',
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
          unit_amount: Math.round(Number(card.valor) * 100),
        },
      ],
      qr_codes: [
        {
          amount: {
            value: Math.round(Number(card.valor) * 100),
          },
        },
      ],
      notification_urls: this.configService.get<string>('PAGBANK_WEBHOOK_URL')
        ? [this.configService.get<string>('PAGBANK_WEBHOOK_URL')]
        : [],
    };

    console.log('📤 Enviando para:', `${baseUrl}/orders`);
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/orders`, payload, {
          headers,
          ...httpConfig,
        }),
      );

      console.log('✅ RESPOSTA:', {
        status: response.status,
        order_id: response.data.id,
        has_qr_code: !!response.data.qr_codes,
      });

      const orderData = response.data;
      const qrCodeData = orderData.qr_codes?.[0];
      const qrCodeText =
        qrCodeData?.text ||
        qrCodeData?.links?.find((link: any) => link.media === 'text/plain')
          ?.href;
      const qrCodeImage = qrCodeData?.links?.find(
        (link: any) => link.media === 'image/png',
      )?.href;

      // Salvar no banco
      const pagamento = await this.prisma.pagamento.create({
        data: {
          id_pedido: createPixQrCodeDto.reference_id,
          charge_id: orderData.id,
          reference_id: orderData.reference_id,
          total_amount:
            qrCodeData?.amount?.value || Math.round(Number(card.valor) * 100),
          origin_amount: Math.round(Number(card.valor) * 100),
          status: 'pending',
          type: 'pix',
          host: 'pagbank',
          qr_code: qrCodeText,
          qr_code_image: qrCodeImage,
          expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return {
        success: true,
        data: {
          order: orderData,
          local_payment_id: pagamento.id,
          qr_code: qrCodeText,
          qr_code_image: qrCodeImage,
          expiration_date: qrCodeData?.expiration_date,
        },
      };
    } catch (error: any) {
      console.error('❌ ERRO:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        url: `${baseUrl}/orders`,
      });

      if (error.response?.status === 401) {
        await this.authenticate();
        throw new Error('Token expirado. Tente novamente.');
      }

      throw new Error(
        error.response?.data?.message || error.message || 'Erro ao criar PIX',
      );
    }
  }

  /**
   * Criar cobrança PIX simplificada
   */
  async createSimplePixCharge(createPixChargeDto: {
    reference_id: string;
    description: string;
    value: number;
    customer_name: string;
    customer_email?: string;
    customer_tax_id?: string;
    expires_in_minutes?: number;
  }): Promise<any> {
    try {
      const pixQrCodeDto: CreatePixQrCodeDto = {
        reference_id: createPixChargeDto.reference_id,
      };

      const result = await this.createPixOrder(pixQrCodeDto);
      const orderData = result.data.order;
      const qrCodeData = orderData.qr_codes?.[0];
      const qrCodeText =
        qrCodeData?.text ||
        qrCodeData?.links?.find((link: any) => link.media === 'text/plain')
          ?.href;
      const qrCodeImage = qrCodeData?.links?.find(
        (link: any) => link.media === 'image/png',
      )?.href;

      return {
        success: true,
        data: {
          id: orderData.id,
          reference_id: orderData.reference_id,
          local_payment_id: result.data.local_payment_id,
          status: orderData.status || 'CREATED',
          qr_code: qrCodeText,
          qr_code_image: qrCodeImage,
          amount: {
            value: qrCodeData?.amount?.value || createPixChargeDto.value * 100,
            currency: 'BRL',
          },
          created_at: orderData.created_at,
          expiration_date: qrCodeData?.expiration_date,
        },
        message: 'Cobrança PIX criada com sucesso',
      };
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao processar cobrança PIX');
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
