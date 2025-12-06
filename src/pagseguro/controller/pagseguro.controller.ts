import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreatePixOrderDto } from '../dto/create-pix-order.dto';
import { PagSeguroService } from '../service/pagseguro.service';
import { CreatePixQrCodeDto } from '../dto/create-pix-qrcode.dto';

@Controller('pagseguro')
@UsePipes(new ValidationPipe({ transform: true }))
export class PagSeguroController {
  constructor(private readonly pagSeguroService: PagSeguroService) {}

  /**
   * Criar pedido com QR Code PIX
   * Endpoint: POST /pagseguro/orders/pix
   */
  @Post('orders/pix')
  @HttpCode(HttpStatus.CREATED)
  async createPixOrder(@Body() createPixQrCodeDto: CreatePixQrCodeDto) {
    try {
      const result =
        await this.pagSeguroService.createPixOrder(createPixQrCodeDto);
      return {
        success: true,
        message: 'Pedido PIX criado com sucesso',
        data: {
          order_id: result.data.order.id,
          reference_id: result.data.order.reference_id,
          qr_code: result.data.qr_code,
          qr_code_image: result.data.qr_code_image,
          expiration_date: result.data.expiration_date,
          local_payment_id: result.data.local_payment_id,
          amount: result.data.order.qr_codes?.[0]?.amount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Erro ao criar pedido PIX',
      };
    }
  }

  /**
   * Criar cobrança PIX simplificada (backward compatibility)
   * Endpoint: POST /pagseguro/pix/charge
   */
  @Post('pix/charge')
  @HttpCode(HttpStatus.CREATED)
  async createSimplePixCharge(
    @Body()
    createPixChargeDto: {
      reference_id: string;
      description: string;
      value: number;
      customer_name: string;
      customer_email?: string;
      customer_tax_id?: string;
      expires_in_minutes?: number;
    },
  ) {
    try {
      // Converter para o novo formato
      const pixQrCodeDto: CreatePixQrCodeDto = {
        reference_id: createPixChargeDto.reference_id,
        customer: {
          name: createPixChargeDto.customer_name,
          email:
            createPixChargeDto.customer_email ||
            `${createPixChargeDto.reference_id}@temp.com`,
          tax_id: createPixChargeDto.customer_tax_id || '00000000000',
          phones: [
            {
              country: '55',
              area: '11',
              number: '999999999',
              type: 'MOBILE',
            },
          ],
        },
        items: [
          {
            name: createPixChargeDto.description.substring(0, 100),
            quantity: 1,
            unit_amount: Math.round(createPixChargeDto.value * 100),
          },
        ],
        qr_codes: [
          {
            amount: {
              value: Math.round(createPixChargeDto.value * 100),
            },
          },
        ],
      };

      const result = await this.pagSeguroService.createPixOrder(pixQrCodeDto);
      return {
        success: true,
        message: 'Cobrança PIX criada com sucesso',
        data: {
          id: result.data.order.id,
          reference_id: result.data.order.reference_id,
          local_payment_id: result.data.local_payment_id,
          status: result.data.order.status,
          qr_code: result.data.qr_code,
          qr_code_image: result.data.qr_code_image,
          amount: {
            value:
              result.data.order.qr_codes?.[0]?.amount?.value ||
              createPixChargeDto.value * 100,
            currency: 'BRL',
          },
          created_at: result.data.order.created_at,
          expiration_date: result.data.expiration_date,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Erro ao criar cobrança PIX',
      };
    }
  }

  /**
   * Consultar pedido por ID
   * Endpoint: GET /pagseguro/orders/:id
   */
  @Get('orders/:id')
  async getOrder(@Param('id') orderId: string) {
    try {
      const result = await this.pagSeguroService.getOrder(orderId);
      return {
        success: true,
        message: 'Pedido encontrado',
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Erro ao buscar pedido',
      };
    }
  }

  /**
   * Cancelar pedido
   * Endpoint: POST /pagseguro/orders/:id/cancel
   */
  @Post('orders/:id/cancel')
  async cancelOrder(@Param('id') orderId: string) {
    try {
      const result = await this.pagSeguroService.cancelOrder(orderId);
      return {
        success: true,
        message: 'Pedido cancelado com sucesso',
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Erro ao cancelar pedido',
      };
    }
  }

  /**
   * Testar autenticação com PagBank
   * Endpoint: GET /pagseguro/test-auth
   */
  // @Get('test-auth')
  // async testAuth() {
  //   try {
  //     const result = await this.pagSeguroService.testAuthentication();
  //     return result;
  //   } catch (error) {
  //     return {
  //       success: false,
  //       error: error.message,
  //     };
  //   }
  // }

  @Get('test-auth-detailed')
  async testAuthDetailed() {
    try {
      const result = await this.pagSeguroService.testAuthentication();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verificar configurações de ambiente
   * Endpoint: GET /pagseguro/check-env
   */
  @Get('check-env')
  async checkEnvironment() {
    try {
      const result = await this.pagSeguroService.checkEnvironment();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verificar API Key (debug)
   * Endpoint: GET /pagseguro/check-api-key
   */
  @Get('check-api-key')
  async checkApiKey() {
    const apiKey = process.env.PAGBANK_API_KEY;

    const analysis = {
      exists: !!apiKey,
      length: apiKey?.length,
      startsWithPsk: apiKey?.startsWith('psk_'),
      format: 'Deve ser: Bearer token (começa com psk_)',
      yourKey: apiKey
        ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`
        : 'Não encontrada',
    };

    console.log('🔐 ANÁLISE DA API KEY:', analysis);

    return {
      success: true,
      analysis,
    };
  }

  /**
   * Buscar pagamento por reference_id (ID do pedido no seu sistema)
   * Endpoint: GET /pagseguro/payment/order/:id
   */
  @Get('payment/order/:id')
  async getPaymentByOrderId(@Param('id') referenceId: string) {
    try {
      // Buscar no banco pelo reference_id
      const pagamentos = await this.pagSeguroService[
        'prisma'
      ].pagamento.findMany({
        where: { id_pedido: referenceId },
        orderBy: { created_at: 'desc' },
      });

      if (!pagamentos || pagamentos.length === 0) {
        return {
          success: false,
          message: 'Nenhum pagamento encontrado para este pedido',
        };
      }

      return {
        success: true,
        data: pagamentos,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Erro ao buscar pagamentos',
      };
    }
  }

  /**
   * Listar pagamentos por status
   * Endpoint: GET /pagseguro/payments
   */
  @Get('payments')
  async getPaymentsByStatus() {
    try {
      const statusCounts = await this.pagSeguroService[
        'prisma'
      ].pagamento.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
        orderBy: {
          _count: {
            status: 'desc',
          },
        },
      });

      const recentPayments = await this.pagSeguroService[
        'prisma'
      ].pagamento.findMany({
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          Card: {
            select: {
              categoria: true,
              subcategoria: true,
              Cliente: {
                select: {
                  nome: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return {
        success: true,
        data: {
          stats: statusCounts,
          recent: recentPayments,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Erro ao listar pagamentos',
      };
    }
  }

  /**
   * Webhook do PagBank (descomentar quando configurar)
   * Endpoint: POST /pagseguro/webhook
   */
  // @Post('webhook')
  // @HttpCode(HttpStatus.OK)
  // async handleWebhook(@Body() webhookData: any, @Headers() headers: any) {
  //   try {
  //     console.log('📩 Webhook recebido:', {
  //       headers,
  //       data: webhookData,
  //     });

  //     // Verificar assinatura do webhook se necessário
  //     const signature = headers['x-pagbank-signature'];

  //     if (webhookData.event === 'ORDER_PAID') {
  //       const orderId = webhookData.order.id;
  //       const charge = webhookData.order.charges[0];

  //       // Atualizar pagamento no banco
  //       await this.pagSeguroService['prisma'].pagamento.updateMany({
  //         where: { charge_id: orderId },
  //         data: {
  //           status: 'paid',
  //           paid_at: new Date(charge.paid_at),
  //           auth_code: charge.payment_response?.code,
  //           response_description: charge.payment_response?.message,
  //           updated_at: new Date(),
  //         },
  //       });

  //       console.log(`✅ Pagamento ${orderId} marcado como pago via webhook`);
  //     }

  //     return { success: true, message: 'Webhook processado' };
  //   } catch (error) {
  //     console.error('❌ Erro no webhook:', error);
  //     return { success: false, error: error.message };
  //   }
  // }
}
