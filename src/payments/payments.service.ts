import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as qs from 'qs';

@Injectable()
export class PaymentsService {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly sellerId: string;

  constructor(private configService: ConfigService) {
    const env = this.configService.get<string>('GETNET_ENV') || 'sandbox';

    this.baseUrl =
      process.env.NODE_ENV !== 'production'
        ? 'https://api-homologacao.getnet.com.br'
        : 'https://api.getnet.com.br';

    this.clientId = this.configService.get<string>('GETNET_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('GETNET_CLIENT_SECRET');
    this.sellerId = this.configService.get<string>('GETNET_SELLER_ID');
  }

  /**
   * Tokeniza os dados do cartão
   * @param card_number Número do cartão
   * @param customer_id ID do cliente
   * @returns Promise com o number_token
   */
  async tokenizeCard(
    card_number: string,
    customer_id: string,
  ): Promise<string> {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/tokens/card`,
        { card_number, customer_id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            seller_id: this.sellerId,
            'Content-Type': 'application/json',
          },
          timeout: 5000, // 5 segundos de timeout
        },
      );

      if (!response.data.number_token) {
        throw new Error('Failed to generate card token');
      }

      return response.data.number_token;
    } catch (error) {
      console.error(
        'Error tokenizing card:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to tokenize card');
    }
  }

  /**
   * Obtém o token de acesso OAuth2
   * @returns Promise com o access_token
   */
  private async getAccessToken(): Promise<string> {
    // Debug 1 - Mostra a baseUrl ANTES de usar
    console.log('[DEBUG] Valor atual de baseUrl:', this.baseUrl);
    console.log(
      '[DEBUG] Tentando obter token em:',
      `${this.baseUrl}/auth/oauth/v2/token`,
    );

    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30000) {
      console.log('[DEBUG] Usando token cacheado (ainda válido)');
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    console.log('[DEBUG] Credenciais em Base64:', auth); // Debug 2 - Mostra o auth básico

    try {
      console.log('[DEBUG] Iniciando requisição para obter token...');

      const response = await axios.post(
        `${this.baseUrl}/auth/oauth/v2/token`,
        qs.stringify({ grant_type: 'client_credentials', scope: 'oob' }),
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 5000,
        },
      );

      console.log('[DEBUG] Token obtido com sucesso!');
      console.log(
        '[DEBUG] Token expira em:',
        response.data.expires_in,
        'segundos',
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('[ERROR] Falha ao obter token:');
      console.error('URL usada:', `${this.baseUrl}/auth/oauth/v2/token`);
      console.error('Código de status:', error.response?.status);
      console.error('Resposta do erro:', error.response?.data);
      console.error('Stack trace:', error.stack);

      throw new Error('Failed to get access token');
    }
  }

  /**
   * Processa pagamento com cartão de crédito
   * @param payload Dados do pagamento
   * @returns Promise com a resposta da transação
   */
  async processCreditCardPayment(payload: any) {
    const token = await this.getAccessToken();

    // Validações básicas
    if (!payload.card_number || !payload.customer_id) {
      throw new Error('Card number and customer ID are required');
    }

    try {
      const number_token = await this.tokenizeCard('5428203065363270', '1');

      const requestData = {
        seller_id: this.sellerId,
        amount: 10000,
        currency: 'BRL',
        order: {
          order_id: '6d2e4380-d8a3-4ccb-9138-c289182818a3',
          sales_tax: 0,
          product_type: 'service',
        },
        customer: {
          customer_id: '1',
          first_name: 'Guilherme',
          last_name: 'Hirle',
          email: 'customer@email.com.br',
          document_type: 'CPF',
          document_number: '49306837852',
          phone_number: '5551999887766',
          billing_address: {
            street: 'Rua doutor paulo de andrade arantes',
            number: '52',
            complement: 'casa',
            district: 'São Paulo',
            city: 'São Paulo',
            state: 'SP',
            country: 'Brasil',
            postal_code: '03451090',
          },
        },
        credit: {
          delayed: false,
          save_card_data: false,
          transaction_type: 'FULL',
          number_installments: 1,
          soft_descriptor: 'LOJA*TESTE*COMPRA-123',
          dynamic_mcc: 7299,
          card: {
            number_token: number_token,
            brand: 'MASTERCARD',
            bin: '542820',
            security_code: '856',
            expiration_month: '12',
            expiration_year: '32',
            cardholder_name: 'GUILHERME HIRLE',
          },
        },
      };

      // const requestData = {
      //   seller_id: this.sellerId,
      //   amount: payload.amount,
      //   currency: 'BRL',
      //   order: {
      //     order_id: payload.order_id || `order_${Date.now()}`,
      //     product_type: payload.product_type || 'service', // Adicionado conforme documentação
      //   },
      //   customer: {
      //     customer_id: payload.customer_id,
      //     first_name: payload.first_name || 'Cliente',
      //     last_name: payload.last_name || 'Não Informado',
      //     name:
      //       payload.name || `${payload.first_name} ${payload.last_name}`.trim(),
      //     email: payload.email || 'no-reply@example.com',
      //     document_type: payload.document_type || 'CPF',
      //     document_number: payload.document_number || '00000000000',
      //   },
      //   device: {
      //     ip_address: payload.ip_address || '127.0.0.1',
      //     device_id: payload.device_id || 'device_id',
      //   },
      //   shippings: payload.shippings || [],
      //   credit: {
      //     delayed: false,
      //     pre_authorization: payload.pre_authorization || false,
      //     save_card_data: payload.save_card_data || false,
      //     transaction_type: payload.transaction_type || 'FULL',
      //     number_installments: payload.number_installments || 1,
      //     soft_descriptor: payload.soft_descriptor || 'Loja',
      //     dynamic_mcc: payload.dynamic_mcc || 0,
      //     number_token,
      //     cardholder_name: payload.cardholder_name,
      //     expiration_month: payload.expiration_month,
      //     expiration_year: payload.expiration_year,
      //     security_code: payload.security_code,
      //     brand: payload.brand,
      //     // Adicionado campos recomendados pela documentação
      //     authenticated: payload.authenticated || false,
      //     authentication_method:
      //       payload.authentication_method || 'no-authentication',
      //   },
      //   sub_merchant: payload.sub_merchant,
      // };

      const response = await axios.post(
        `${this.baseUrl}/v1/payments/credit`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            // Authorization: `Bearer 72402c54-6bd3-4895-a6b4-adfded0c11dc`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 segundos para transação
        },
      );

      return response.data;
    } catch (error) {
      console.error(
        'Error processing payment:',
        error.response?.data || error.message,
      );
      throw new Error(error);
    }
  }

  /**
   * Método para capturar uma pré-autorização
   * @param payment_id ID do pagamento
   * @param amount Valor a ser capturado
   */
  async capturePreAuthorization(payment_id: string, amount: number) {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/payments/credit/${payment_id}/confirm`,
        { amount },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            seller_id: this.sellerId,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error(
        'Error capturing pre-authorization:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to capture pre-authorization');
    }
  }

  /**
   * Método para cancelar uma transação
   * @param payment_id ID do pagamento
   * @param amount Valor a ser cancelado (opcional)
   */
  async cancelPayment(payment_id: string, amount?: number) {
    const token = await this.getAccessToken();

    try {
      const payload = amount ? { amount } : {};
      const response = await axios.post(
        `${this.baseUrl}/v1/payments/credit/${payment_id}/cancel`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            seller_id: this.sellerId,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error(
        'Error canceling payment:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to cancel payment');
    }
  }
}
