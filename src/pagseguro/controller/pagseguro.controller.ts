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

// POST   /pagseguro/pix/charge          # Criar cobrança PIX
// GET    /pagseguro/charge/:id          # Buscar charge por ID
// GET    /pagseguro/charge/reference/:id # Buscar charge por reference_id
// POST   /pagseguro/charge/:id/cancel   # Cancelar charge
// GET    /pagseguro/payments            # Listar pagamentos por status
// GET    /pagseguro/payments/stats      # Estatísticas de pagamentos
// POST   /pagseguro/webhook             # Webhook do PagSeguro
// GET    /pagseguro/payment/order/:id   # Buscar pagamento por ID do pedido
// POST   /pagseguro/payment/:id/refund  # Solicitar reembolso

@Controller('pagseguro')
@UsePipes(new ValidationPipe({ transform: true }))
export class PagSeguroController {
  constructor(private readonly pagSeguroService: PagSeguroService) {}
  @Post('orders/pix')
  @HttpCode(HttpStatus.CREATED)
  async createPixOrder(@Body() createPixOrderDto: CreatePixOrderDto) {
    try {
      const result =
        await this.pagSeguroService.createPixOrder(createPixOrderDto);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Erro ao criar pedido PIX',
      };
    }
  }

  @Post('pix/charge')
  @HttpCode(HttpStatus.CREATED)
  async createSimplePixCharge(@Body() createPixChargeDto: any) {
    try {
      const result =
        await this.pagSeguroService.createSimplePixCharge(createPixChargeDto);
      return result; // Já vem formatado pelo service
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Erro ao criar cobrança PIX',
      };
    }
  }

  @Get('orders/:id')
  async getOrder(@Param('id') orderId: string) {
    try {
      const result = await this.pagSeguroService.getOrder(orderId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Erro ao buscar pedido',
      };
    }
  }

  @Post('orders/:id/cancel')
  async cancelOrder(@Param('id') orderId: string) {
    try {
      const result = await this.pagSeguroService.cancelOrder(orderId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Erro ao cancelar pedido',
      };
    }
  }

  @Get('test-auth')
  async testAuth() {
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
  @Get('check-api-key')
  async checkApiKey() {
    const apiKey = '2040A87FCBFC4D65A830248F7B9E6CD2';

    const analysis = {
      exists: !!apiKey,
      length: apiKey?.length,
      startsWithPsk: apiKey?.startsWith('psk_'),
      format: 'Deve ser: psk_ + 32 caracteres',
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
  // @Post('webhook')
  // async handleWebhook(@Body() webhookData: any) {
  //   // NOVA ESTRUTURA DO WEBHOOK
  //   if (webhookData.event === 'ORDER_PAID') {
  //     const orderId = webhookData.order.id;
  //     const charge = webhookData.order.charges[0];

  //     await this.handleChargePaid({
  //       id: charge.id,
  //       reference_id: webhookData.order.reference_id,
  //       status: charge.status,
  //       paid_at: charge.paid_at,
  //       amount: charge.amount,
  //     });
  //   }
  // }
}
