import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as qs from 'qs';
import { PrismaService } from 'src/prisma/prisma.service';
import { InstallmentsService } from '../installments/service/installments.service';
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
    private readonly installmentsService: InstallmentsService,
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
      // VALIDAÇÃO DAS PARCELAS - Verificar se os valores batem
      if (payload.credit.number_installments > 1) {
        const installmentValidation = await this.validateInstallmentValues(
          payload.amount, // valor total que veio do frontend (em centavos)
          payload.credit.number_installments,
          payload.installment_data, // novo campo com dados da parcela
        );

        if (!installmentValidation.isValid) {
          throw new Error('Dados de parcelamento inválidos ou inconsistentes');
        }

        // Usar o valor total calculado pelo sistema de parcelas
        payload.amount = installmentValidation.calculatedTotal;
      }

      // 1. Tokenização do cartão
      const number_token = await this.tokenizeCard(
        payload.credit.card.number_token,
        payload.customer.customer_id,
      );

      // 2. Montar o payload para a API de pagamentos
      const requestData = {
        seller_id: this.sellerId,
        amount: payload.totalAmount, // Já validado e potencialmente ajustado
        currency: payload.currency || 'BRL',
        order: {
          order_id: payload.id_pedido,
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
        device: payload.device,
        credit: {
          delayed: payload.credit.delayed || false,
          save_card_data: payload.credit.save_card_data || false,
          transaction_type: payload.credit.transaction_type,
          number_installments: payload.credit.number_installments || 1,
          soft_descriptor: payload.credit.soft_descriptor || 'TUDU',
          dynamic_mcc: payload.credit.dynamic_mcc || 7298,
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

      // 6. Registrar pagamento com SUCESSO no banco - COM DADOS DAS PARCELAS
      pagamentoRegistrado = await this.criarPagamento({
        id_pagamento: responseData.payment_id,
        id_pedido: payload.id_pedido,
        total_amount: payload.totalAmount, // valor com juros
        origin_amount: payload.originAmount, // valor sem juros
        status: responseData.status,
        auth_code: responseData.authorization_code,
        response_description: 'Pagamento realizado com sucesso',
        installments: payload.credit.number_installments || 1,
        installments_amount: payload.credit.amount_installment,
        authorization_date: responseData.authorized_at
          ? new Date(responseData.authorized_at)
          : new Date(),
        type: 'CREDIT_CARD',
        host: 'GETNET',
      });

      // 7. Retornar resposta de SUCESSO
      return {
        success: true,
        id: pagamentoRegistrado.id,
        id_pagamento: responseData.payment_id,
        id_pedido: payload.id_pedido,
        authorization_code: responseData.authorization_code,
        status: responseData.status,
        status_description: responseData.status_description,
        total_amount: responseData.amount,
        installments: payload.credit.number_installments,
        installment_amount: payload.credit.amount_installment,
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
        id_pagamento: errorDetails?.payment_id,
        id_pedido: payload.id_pedido,
        total_amount: payload.totalAmount,
        origin_amount: payload.originAmount,
        status: errorStatus,
        response_description: errorDescription,
        installments: payload.credit.number_installments || 1,
        installments_amount: payload.credit.amount_installment,
        type: 'CREDIT_CARD',
        host: 'GETNET',
      });

      // 9. Retornar resposta de ERRO
      return {
        success: false,
        id: pagamentoRegistrado.id,
        id_pagamento: errorDetails?.payment_id,
        id_pedido: payload.id_pedido,
        error: errorDescription,
        status: errorStatus,
        error_code: errorDetails?.error_code || 'UNKNOWN_ERROR',
        details: error.response?.data?.details,
      };
    }
  }

  // MÉTODO AUXILIAR PARA VALIDAR PARCELAS
  private async validateInstallmentValues(
    receivedTotal: number,
    installments: number,
    installmentData: any,
  ): Promise<{ isValid: boolean; calculatedTotal: number }> {
    try {
      // Se não houver dados de parcela, calcular aqui
      if (!installmentData) {
        const calculation = this.installmentsService.calculateInstallments({
          totalValue: receivedTotal,
          maxInstallments: installments,
        });

        const option = calculation.options.find(
          (opt) => opt.installments === installments,
        );

        return {
          isValid: true,
          calculatedTotal: option?.totalValue || receivedTotal,
        };
      }

      // Validar dados recebidos do frontend
      const expectedCalculation =
        this.installmentsService.calculateInstallments({
          totalValue: installmentData.original_value,
          maxInstallments: installments,
        });

      const expectedOption = expectedCalculation.options.find(
        (opt) => opt.installments === installments,
      );

      if (!expectedOption) {
        return { isValid: false, calculatedTotal: receivedTotal };
      }

      // Validar com tolerância de 10 centavos
      const totalValid =
        Math.abs(expectedOption.totalValue - receivedTotal) < 10;
      const installmentValid =
        Math.abs(
          expectedOption.installmentValue - installmentData.installment_value,
        ) < 10;
      const interestValid =
        Math.abs(expectedOption.interestRate - installmentData.interest_rate) <
        0.1;

      return {
        isValid: totalValid && installmentValid && interestValid,
        calculatedTotal: expectedOption.totalValue,
      };
    } catch (error) {
      console.error('Erro na validação de parcelas:', error);
      return { isValid: false, calculatedTotal: receivedTotal };
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

  async cancelarPagamentoCompleto(id_pagamento: string, amount?: number) {
    const token = await this.getAccessToken();

    // 1. Buscar o pagamento no banco para verificar existência
    const pagamento = await this.prisma.pagamento.findFirst({
      where: { id_pagamento: id_pagamento },
    });

    try {
      if (!pagamento) {
        throw new Error('Pagamento não encontrado');
      }

      // 2. Fazer o cancelamento na Getnet usando id_pagamento
      const cancel_amount = amount || pagamento.total_amount; // ✅ Definir o valor aqui

      // const cancelamentoData = {
      //   reversed_amount: cancel_amount, // ✅ Campo CORRETO
      // };

      const httpsAgent = new https.Agent({
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      });

      const response = await axios.post(
        `${this.baseUrl}/v1/payments/credit/${pagamento.id_pagamento}/cancel`,
        {
          cancel_amount: cancel_amount,
        },
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
      console.log('======== RESPONSE ===========');
      console.log(responseData);

      // 3. Atualizar o status no banco
      await this.prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          status: 'CANCELLED',
          reversed_amount: cancel_amount, // ✅ Usar a variável definida
          response_description: 'Pagamento cancelado com sucesso',
        },
      });

      return {
        success: true,
        cancel_id: responseData.cancel_id,
        cancel_amount: responseData.cancel_amount,
        status: responseData.status,
      };
    } catch (error) {
      console.error(
        'Error canceling payment:',
        error.response?.data || error.message,
      );

      // 4. Registrar falha no cancelamento
      // if (pagamento) {
      //   await this.prisma.pagamento.update({
      //     where: { id: pagamento.id },
      //     data: {
      //       status: 'CANCEL_FAILED',
      //       response_description:
      //         error.response?.data?.message || 'Falha no cancelamento',
      //     },
      //   });
      // }

      return {
        success: false,
        error: error.response?.data?.message || 'Erro ao cancelar pagamento',
        details: error.response?.data,
      };
    }
  }

  /**
   * Estorna parcialmente um pagamento
   */
  // async estornarParcialmente(id_pagamento: string, amount: number) {
  //   const token = await this.getAccessToken();

  //   try {
  //     // 1. Buscar o pagamento no banco
  //     const pagamento = await this.prisma.pagamento.findFirst({
  //       where: { id_pagamento },
  //     });

  //     if (!pagamento) {
  //       throw new Error('Pagamento não encontrado');
  //     }

  //     if (amount > pagamento.amount) {
  //       throw new Error('Valor de estorno maior que o valor do pagamento');
  //     }

  //     // 2. Fazer o estorno parcial na Getnet
  //     const estornoData = {
  //       cancel_amount: amount,
  //       cancel_custom_key: `PARTIAL-REFUND-${Date.now()}`,
  //     };

  //     const httpsAgent = new https.Agent({
  //       minVersion: 'TLSv1.2',
  //       rejectUnauthorized: true,
  //     });

  //     const response = await axios.post(
  //       `${this.baseUrl}/v1/payments/credit/${id_pagamento}/cancel`,
  //       estornoData,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //           'Content-Type': 'application/json',
  //         },
  //         httpsAgent,
  //         timeout: 10000,
  //       },
  //     );

  //     const responseData = response.data;

  //     // 3. Atualizar o status no banco
  //     await this.prisma.pagamento.update({
  //       where: { id: pagamento.id },
  //       data: {
  //         status:
  //           amount === pagamento.amount ? 'CANCELLED' : 'PARTIALLY_REFUNDED',
  //         response_description: `Estorno de ${amount} realizado com sucesso`,
  //         reversed_amount: amount,
  //       },
  //     });

  //     return {
  //       success: true,
  //       cancel_id: responseData.cancel_id,
  //       cancel_amount: responseData.cancel_amount,
  //       status: responseData.status,
  //     };
  //   } catch (error) {
  //     console.error(
  //       'Error processing refund:',
  //       error.response?.data || error.message,
  //     );

  //     return {
  //       success: false,
  //       error: error.response?.data?.message || 'Erro ao processar estorno',
  //       details: error.response?.data,
  //     };
  //   }
  // }

  /**
   * Consulta status de um pagamento
   */
  async consultarStatusPagamento(id_pagamento: string) {
    const token = await this.getAccessToken();

    try {
      const httpsAgent = new https.Agent({
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      });

      const response = await axios.get(
        `${this.baseUrl}/v1/payments/credit/${id_pagamento}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          httpsAgent,
          timeout: 10000,
        },
      );

      return {
        success: true,
        status: response.data.status,
        payment_data: response.data,
      };
    } catch (error) {
      console.error(
        'Error checking payment status:',
        error.response?.data || error.message,
      );

      return {
        success: false,
        error: error.response?.data?.message || 'Erro ao consultar status',
        details: error.response?.data,
      };
    }
  }

  /**
   * Busca pagamento por ID do pedido
   */
  async buscarPagamentoPorPedido(id_pedido: string) {
    return this.prisma.pagamento.findMany({
      where: { id_pedido },
      select: {
        id: true, // ID interno do seu banco (auto-increment)
        id_pagamento: true, // ID da Getnet (antigo id_pagamento_getnet)
        id_pedido: true, // Número do pedido
        total_amount: true,
        origin_amount: true,
        status: true,
        auth_code: true,
        response_description: true,
        type: true,
        host: true,
        installments: true,
        installments_amount: true,
        authorization_date: true,
        capture_date: true,
        reversed_amount: true,
        created_at: true,
        updated_at: true,
        // Incluir relações se necessário
        Card: {
          select: {
            id_pedido: true,
            categoria: true,
            subcategoria: true,
            valor: true,
            status_pedido: true,
            Prestador: {
              select: {
                id_prestador: true,
                nome: true,
                sobrenome: true,
                foto: true,
                especializacao: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async criarPagamento(pagamentoData: {
    id_pagamento?: string;
    id_pedido: string;
    total_amount: number;
    origin_amount: number;
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
      data: {
        id_pagamento: pagamentoData.id_pagamento,
        id_pedido: pagamentoData.id_pedido,
        total_amount: pagamentoData.total_amount,
        origin_amount: pagamentoData.origin_amount,
        auth_code: pagamentoData.auth_code,
        status: pagamentoData.status,
        response_description: pagamentoData.response_description,
        type: pagamentoData.type,
        host: pagamentoData.host,
        installments: pagamentoData.installments,
        installments_amount: pagamentoData.installments_amount,
        authorization_date: pagamentoData.authorization_date,
        capture_date: pagamentoData.capture_date,
        reversed_amount: pagamentoData.reversed_amount,
      },
    });
  }
  async atualizarPagamento(id: number, data: any) {
    return this.prisma.pagamento.update({
      where: { id }, // Usa o ID interno (campo id)
      data,
    });
  }

  /**
   * Busca todos os pagamentos de um cliente com informações completas
   */
  async buscarPagamentosPorCliente(id_cliente: number) {
    return this.prisma.pagamento.findMany({
      where: {
        Card: {
          id_cliente: id_cliente,
        },
      },
      include: {
        Card: {
          include: {
            Prestador: {
              select: {
                id_prestador: true,
                nome: true,
                sobrenome: true,
                foto: true,
                especializacao: true,
              },
            },
            Cliente: {
              select: {
                id_cliente: true,
                nome: true,
                sobrenome: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * Busca pagamentos por cliente com paginação
   */
  async buscarPagamentosPorClientePaginado(
    id_cliente: number,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const [pagamentos, total] = await Promise.all([
      this.prisma.pagamento.findMany({
        where: {
          Card: {
            id_cliente: id_cliente,
          },
        },
        include: {
          Card: {
            include: {
              Prestador: {
                select: {
                  id_prestador: true,
                  nome: true,
                  sobrenome: true,
                  foto: true,
                  especializacao: true,
                },
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.pagamento.count({
        where: {
          Card: {
            id_cliente: id_cliente,
          },
        },
      }),
    ]);

    return {
      pagamentos,
      paginacao: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Estatísticas de pagamentos do cliente
   */
  async estatisticasPagamentosCliente(id_cliente: number) {
    const pagamentos = await this.prisma.pagamento.findMany({
      where: {
        Card: {
          id_cliente: id_cliente,
        },
      },
      select: {
        total_amount: true,
        status: true,
        created_at: true,
      },
    });

    const totalGasto = pagamentos
      .filter((p) => p.status === 'APPROVED')
      .reduce((sum, p) => sum + Number(p.total_amount), 0);

    const totalPagamentos = pagamentos.length;
    const pagamentosAprovados = pagamentos.filter(
      (p) => p.status === 'APPROVED',
    ).length;
    const pagamentosPendentes = pagamentos.filter(
      (p) => p.status === 'PENDING',
    ).length;
    const pagamentosCancelados = pagamentos.filter(
      (p) => p.status === 'CANCELLED',
    ).length;

    return {
      totalGasto,
      totalPagamentos,
      pagamentosAprovados,
      pagamentosPendentes,
      pagamentosCancelados,
      taxaAprovacao:
        totalPagamentos > 0 ? (pagamentosAprovados / totalPagamentos) * 100 : 0,
    };
  }
}
