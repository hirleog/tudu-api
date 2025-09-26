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

@Injectable()
export class MalgaService {
  private readonly apiUrl = 'https://api.malga.io/v1';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get('MALGA_API_KEY');
  }

  private getHeaders() {
    return {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  // === TOKENIZATION METHODS ===
  async createToken(createTokenDto: CreateTokenDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/tokens`, createTokenDto, {
          headers: this.getHeaders(),
        }),
      );
      return response.data;
    } catch (error) {
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

  async tokenizeAndPay(paymentData: {
    merchantId: string;
    amount: number;
    currency: string;
    orderId: string;
    customer: CustomerDto;
    card: {
      number: string;
      expirationMonth: string;
      expirationYear: string;
      securityCode: string;
      holderName: string;
    };
    installments?: number;
    capture?: boolean;
    saveCard?: boolean;
  }) {
    try {
      // Sempre gera o token
      const tokenResponse = await this.createToken({
        card: paymentData.card,
      });
      const tokenId = tokenResponse.tokenId;

      // Aqui você pode salvar o token se saveCard for true (lógica extra, se necessário)

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
            number: `token_${tokenId}`,
            expirationMonth: paymentData.card.expirationMonth,
            expirationYear: paymentData.card.expirationYear,
            securityCode: paymentData.card.securityCode,
            holderName: paymentData.card.holderName,
          },
        },
        capture: paymentData.capture !== false,
      };

      const chargeResponse = await this.createCharge(chargeData);

      return {
        ...chargeResponse,
        tokenId: paymentData.saveCard ? tokenId : undefined,
      };
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro no fluxo de tokenização e pagamento',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
