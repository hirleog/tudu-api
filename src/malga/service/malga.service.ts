// src/malga/malga.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { CreateTokenDto, ValidateTokenDto } from '../dto/tokenization.dto';
import { CustomerCreationDto } from '../dto/tokenization.dto';
import {
  CreateChargeDto,
  CreatePaymentDto,
  CustomerDto,
  UpdateChargeDto,
} from '../dto/create-create.dto';
import { PaymentsService } from 'src/getnet/payments/payments.service';

@Injectable()
export class MalgaService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly clientId: string;
  private readonly merchantId: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private paymentsService: PaymentsService,
  ) {
    this.apiUrl =
      process.env.NODE_ENV !== 'production'
        ? 'https://sandbox-api.malga.io/v1'
        : 'https://api.malga.io/v1';

    this.apiKey = this.configService.get('MALGA_API_KEY');
    this.clientId = this.configService.get('MALGA_CLIENT_ID');
    this.merchantId = this.configService.get('MALGA_MERCHANT_ID');
  }

  private getHeaders() {
    console.log('X-Api-Key', this.apiKey);
    console.log('X-Client-Id', this.clientId);
    console.log('merchantId', this.merchantId);
    console.log('apiUrl', this.apiUrl);

    return {
      'X-Api-Key': this.apiKey,
      'X-Client-Id': this.clientId,
      'Content-Type': 'application/json',
    };
  }

  // === TOKENIZATION METHODS ===
  async createToken(createTokenDto: CreateTokenDto) {
    try {
      console.log('Enviando para Malga:', createTokenDto); // ← Debug

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/tokens`,
          createTokenDto, // ← Envie o DTO diretamente, sem envelope
          { headers: this.getHeaders() },
        ),
      );

      return response.data;
    } catch (error) {
      console.log('Erro na tokenização:', error.response?.data);
      throw new HttpException(
        error.response?.data || 'Erro ao criar token',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async validateToken(validateTokenDto: ValidateTokenDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/tokens/validate`,
          validateTokenDto,
          { headers: this.getHeaders() },
        ),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao validar token',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getToken(tokenId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/tokens/${tokenId}`, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao buscar token',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async listTokens(customerId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/tokens?customerId=${customerId}`, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao listar tokens',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteToken(tokenId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.delete(`${this.apiUrl}/tokens/${tokenId}`, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao deletar token',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // === CUSTOMER MANAGEMENT ===
  async createCustomer(customerData: CustomerCreationDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/customers`, customerData, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao criar cliente',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCustomer(customerId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/customers/${customerId}`, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao buscar cliente',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // === CHARGES METHODS ===
  async createCharge(createChargeDto: CreateChargeDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/charges`, createChargeDto, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao criar charge',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCharge(chargeId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/charges/${chargeId}`, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao buscar charge',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async listCharges(query: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    try {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });

      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/charges?${params.toString()}`, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao listar charges',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateCharge(chargeId: string, updateChargeDto: UpdateChargeDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.patch(
          `${this.apiUrl}/charges/${chargeId}`,
          updateChargeDto,
          { headers: this.getHeaders() },
        ),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao atualizar charge',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // === PAYMENTS METHODS ===
  async createPayment(createPaymentDto: CreatePaymentDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/payments`, createPaymentDto, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao criar pagamento',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPayment(paymentId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/payments/${paymentId}`, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao buscar pagamento',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async capturePayment(paymentId: string, amount?: number) {
    try {
      const payload = amount ? { amount } : {};
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/payments/${paymentId}/capture`,
          payload,
          { headers: this.getHeaders() },
        ),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao capturar pagamento',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async cancelPayment(paymentId: string, amount?: number) {
    try {
      const payload = amount ? { amount } : {};
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/payments/${paymentId}/cancel`,
          payload,
          { headers: this.getHeaders() },
        ),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao cancelar pagamento',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // === FLUXOS ESPECIAIS ===
  async processPaymentWithToken(paymentData: {
    merchantId: string;
    amount: number;
    currency: string;
    orderId: string;
    customer: CustomerDto;
    tokenId: string;
    securityCode: string;
    installments?: number;
    capture?: boolean;
  }) {
    try {
      await this.validateToken({
        tokenId: paymentData.tokenId,
        securityCode: paymentData.securityCode,
      });

      const chargeData: CreateChargeDto = {
        merchantId: paymentData.merchantId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        orderId: paymentData.orderId,
        customer: paymentData.customer,
        paymentMethod: {
          paymentType: 'credit',
          installments: paymentData.installments || 1,
          card: {
            number: `token_${paymentData.tokenId}`,
            expirationMonth: '01',
            expirationYear: '2030',
            securityCode: paymentData.securityCode,
            holderName: 'Tokenized Card',
          },
        },
        capture: paymentData.capture !== false,
      };

      return this.createCharge(chargeData);
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao processar pagamento com token',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async tokenizeAndPay(payload: any) {
    let pagamentoRegistrado = null;

    try {
      // VALIDAÇÃO DAS PARCELAS (usando os novos campos)
      const installments = payload.paymentMethod.installments || 1;
      console.log('installments', installments);

      // // 1. Tokenização do cartão (usando os novos campos do payload)
      // const tokenResponse = await this.createToken({
      //   card: {
      //     cardHolderName: payload.paymentSource.card.cardHolderName,
      //     cardNumber: payload.paymentSource.card.cardNumber,
      //     cardCvv: payload.paymentSource.card.cardCvv,
      //     cardExpirationDate: payload.paymentSource.card.cardExpirationDate,
      //   },
      // });

      // console.log('tokenResponse', tokenResponse);

      // const tokenId = tokenResponse.tokenId;

      // 2. Montar payload no formato Malga CORRIGIDO
      const malgaPayload = {
        appInfo: {
          platform: {
            integrator: 'tudu-manager',
            name: 'TUDU Serviços',
            version: '1.0',
          },
          device: {
            name: 'iOS',
            version: '10.12',
          },
          system: {
            name: 'VTEX',
            version: '13.12',
          },
        },
        merchantId: this.merchantId,
        amount: payload.amount,
        currency: payload.currency || 'BRL',
        statementDescriptor: payload.statementDescriptor || 'TUDU',
        description: payload.description || `Pedido ${payload.id_pedido}`,
        capture: payload.capture !== undefined ? payload.capture : false,
        orderId: payload.orderId,
        paymentMethod: {
          paymentType: payload.paymentMethod.paymentType,
          installments: installments,
        },
        paymentSource: {
          sourceType: 'token',
          tokenId: payload.paymentSource.card.cardNumber,
          // "tokenId": "tok_2O7b2s7h8Q9r6t5Y4u3v1w2x3y"
        },
      };

      {
        // appInfo PRIMEIRO (conforme exemplo que funciona)
        //   appInfo: payload.appInfo || {
        //     platform: {
        //       integrator: 'tudu-manager',
        //       name: 'TUDU Serviços',
        //       version: '1.0',
        //     },
        //     device: {
        //       name: 'Web',
        //       version: '1.0',
        //     },
        //     system: {
        //       name: 'TUDU Sistema',
        //       version: '1.0',
        //     },
        //   },
        //   merchantId: this.merchantId,
        // amount: payload.amount, // Já validado e potencialmente ajustado
        // currency: payload.currency || 'BRL',
        // statementDescriptor: payload.statementDescriptor || 'TUDU',
        // description: payload.description || `Pedido ${payload.id_pedido}`,
        // capture: payload.capture !== undefined ? payload.capture : false,
        // orderId: payload.orderId,
        //   // Estrutura de paymentMethod da Malga
        // paymentMethod: {
        //   paymentType: payload.paymentMethod.paymentType,
        //   installments: installments,
        // },
        //   // Estrutura de paymentSource da Malga - CORRIGIDO COM prefixo token_
        //   paymentSource: {
        //     sourceType: payload.paymentSource.sourceType,
        // card: {
        //   cardNumber: payload.paymentSource.card.cardNumbe, // ← CORREÇÃO: adicionar prefixo token_
        //   cardCvv: payload.paymentSource.card.cardCvv,
        //   cardExpirationDate: payload.paymentSource.card.cardExpirationDate,
        //   cardHolderName: payload.paymentSource.card.cardHolderName,
        // },
        //   },
      }

      console.log('payload malga', malgaPayload);

      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/charges`, malgaPayload, {
          headers: this.getHeaders(),
        }),
      );

      const responseData = response.data;

      // 3. Registrar pagamento no banco - ATUALIZADO
      pagamentoRegistrado = await this.paymentsService.criarPagamento({
        id_pagamento: responseData.id,
        id_pedido: payload.id_pedido,
        total_amount: payload.amount,
        origin_amount: payload.originAmount, // valor sem juros
        status: responseData.status,
        auth_code: responseData.authorizationCode,
        response_description: payload.capture
          ? 'Pagamento realizado com sucesso'
          : 'Pré-autorização realizada com sucesso',
        installments: installments,
        installments_amount:
          payload.credit?.amount_installment ||
          Math.round(payload.amount / installments),
        authorization_date: responseData.createdAt
          ? new Date(responseData.createdAt)
          : new Date(),
        type: 'CREDIT_CARD',
        host: 'MALGA',
        charge_id: responseData.id, // Guardar o chargeId para captura futura
      });

      // 4. Retornar resposta de SUCESSO
      return {
        responseData,
        // success: true,
        // id: pagamentoRegistrado.id,
        // id_pagamento: responseData.id,
        // charge_id: responseData.id,
        // id_pedido: payload.id_pedido,
        // authorization_code: responseData.authorizationCode,
        // status: responseData.status,
        // status_description: responseData.status,
        // total_amount: responseData.amount,
        // installments: installments,
        // installment_amount:
        //   payload.credit?.amount_installment ||
        //   Math.round(payload.amount / installments),
        // capture: malgaPayload.capture,
      };
    } catch (error) {
      console.error(
        'Error processing payment with Malga:',
        error.response?.data || error.message,
      );

      const errorDetails = error.response?.data;
      const errorStatus = errorDetails?.status || 'ERROR';
      const errorDescription =
        errorDetails?.message || 'Erro ao processar pagamento';

      const installments = payload.paymentMethod?.installments || 1;

      // 5. Registrar pagamento com ERRO no banco
      pagamentoRegistrado = await this.paymentsService.criarPagamento({
        id_pagamento: errorDetails?.id,
        id_pedido: payload.id_pedido,
        total_amount: payload.amount,
        origin_amount: payload.originAmount || payload.amount,
        status: errorStatus,
        response_description: errorDescription,
        installments: installments,
        installments_amount:
          payload.credit?.amount_installment ||
          Math.round(payload.amount / installments),
        type: 'CREDIT_CARD',
        host: 'MALGA',
      });

      // 6. Retornar resposta de ERRO
      return {
        error,
        // success: false,
        // id: pagamentoRegistrado.id,
        // id_pagamento: errorDetails?.id,
        // id_pedido: payload.id_pedido,
        // error: errorDescription,
        // status: errorStatus,
        // error_code: errorDetails?.code || 'UNKNOWN_ERROR',
        // details: error.response?.data,
      };
    }
  }
}
