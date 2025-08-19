import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as qs from 'qs';
import { PrismaService } from 'src/prisma/prisma.service';
const https = require('https');
const tls = require('tls');

@Injectable()
export class PaymentsService {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly sellerId: string;

  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
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
    let pagamentoRegistrado = null;

    try {
      // 1. Tokenização do cartão
      const number_token = await this.tokenizeCard(
        payload.credit.card.number_token,
        payload.customer.customer_id,
      );

      // 2. Montar o payload para a API de pagamentos
      const requestData = {
        seller_id: this.sellerId,
        amount: payload.amount,
        currency: payload.currency || 'BRL',
        order: {
          order_id: payload.order.order_id,
          product_type: payload.order.product_type || 'service',
        },
        customer: {
          customer_id: payload.customer.customer_id,
          first_name: payload.customer.first_name,
          last_name: payload.customer.last_name,
          document_type: payload.customer.document_type || 'CPF',
          document_number: payload.customer.document_number,
          email: payload.customer.email,
          phone_number: payload.customer.phone_number,
          billing_address: {
            street: payload.customer.billing_address.street,
            number: payload.customer.billing_address.number,
            district: payload.customer.billing_address.district,
            city: payload.customer.billing_address.city,
            state: payload.customer.billing_address.state,
            country: payload.customer.billing_address.country || 'Brasil',
            postal_code: payload.customer.billing_address.postal_code,
          },
        },
        device: {
          ip_address: payload.device.ip_address || '127.0.0.1',
        },
        credit: {
          delayed: payload.credit.delayed || false,
          save_card_data: payload.credit.save_card_data || false,
          transaction_type: payload.credit.transaction_type || 'FULL',
          number_installments: payload.credit.number_installments || 1,
          soft_descriptor: payload.credit.soft_descriptor || 'TUDU',
          dynamic_mcc: payload.credit.dynamic_mcc || 7299,
          card: {
            number_token: number_token,
            security_code: payload.credit.card.security_code,
            expiration_month: payload.credit.card.expiration_month,
            expiration_year: payload.credit.card.expiration_year,
            cardholder_name: payload.credit.card.cardholder_name,
          },
        },
      };

      console.log('Request data:', JSON.stringify(requestData));

      // 3. Validações
      if (!number_token) {
        throw new Error('Falha na tokenização do cartão');
      }

      // 4. Configuração HTTPS
      const httpsAgent = new https.Agent({
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      });

      // 5. Fazer a requisição para Getnet
      const response = await axios.post(
        `${this.baseUrl}/v1/payments/credit`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          httpsAgent,
          timeout: 10000,
        },
      );

      const responseData = response.data;

      // 6. Registrar pagamento com SUCESSO no banco
      pagamentoRegistrado = await this.criarPagamento({
        id_pedido: payload.order.order_id, // Use order_id do payload
        amount: payload.amount,
        status: responseData.status || 'APPROVED', // Status da Getnet
        auth_code: responseData.authorization_code,
        response_description:
          responseData.status_description || 'Pagamento aprovado',
        installments: payload.credit.number_installments || 1,
        installments_amount:
          payload.amount / (payload.credit.number_installments || 1),
        authorization_date: responseData.authorized_at
          ? new Date(responseData.authorized_at)
          : new Date(),
        type: 'CREDIT_CARD',
        host: 'GETNET',
      });

      // 7. Retornar resposta de SUCESSO (sem estrutura de erro)
      return {
        success: true,
        payment_id: responseData.payment_id,
        authorization_code: responseData.authorization_code,
        status: responseData.status,
        status_description: responseData.status_description,
        amount: responseData.amount,
        order_id: responseData.order?.order_id,
        id_pagamento: pagamentoRegistrado.id_pagamento, // ID do registro no seu banco
      };
    } catch (error) {
      console.error(
        'Error processing payment:',
        error.response?.data || error.message,
      );

      const errorDetails = error.response?.data?.details?.[0];
      const errorStatus = errorDetails?.status || 'ERROR';
      const errorDescription =
        errorDetails?.description || 'Erro ao processar pagamento';

      // 8. Registrar pagamento com ERRO no banco
      pagamentoRegistrado = await this.criarPagamento({
        id_pedido: payload.order.order_id,
        amount: payload.amount,
        status: errorStatus,
        response_description: errorDescription,
        installments: payload.credit.number_installments || 1,
        installments_amount:
          payload.amount / (payload.credit.number_installments || 1),
        type: 'CREDIT_CARD',
        host: 'GETNET',
      });

      // 9. Retornar resposta de ERRO (estrutura diferente do sucesso)
      return {
        success: false,
        error: errorDescription,
        status: errorStatus,
        error_code: errorDetails?.error_code || 'UNKNOWN_ERROR',
        payment_id: errorDetails?.payment_id,
        id_pagamento: pagamentoRegistrado.id_pagamento,
        details: error.response?.data?.details,
      };
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

  async criarPagamento(pagamentoData: {
    id_pedido: string;
    amount: number;
    auth_code?: string;
    status: string;
    response_description?: string;
    type?: string;
    host?: string;
    installments?: number;
    installments_amount?: number;
    authorization_date?: Date;
    capture_date?: Date;
    reversed_amount?: number;
  }) {
    return this.prisma.pagamento.create({
      data: pagamentoData,
    });
  }

  async atualizarPagamento(id_pagamento: number, data: any) {
    return this.prisma.pagamento.update({
      where: { id_pagamento },
      data,
    });
  }
}
