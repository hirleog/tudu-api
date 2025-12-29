import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreatePixQrCodeDto } from '../dto/create-pix-qrcode.dto';
import { PagSeguroService } from '../service/pagseguro.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('pagseguro')
@UsePipes(new ValidationPipe({ transform: true }))
export class PagSeguroController {
  constructor(
    private readonly pagSeguroService: PagSeguroService,
    private readonly prisma: PrismaService,
  ) {}

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

  @Post(':chargeId/pix-cancel')
  async cancelPix(
    @Param('chargeId') chargeId: string,
    @Body() payload: { amount?: number },
  ) {
    const result = await this.pagSeguroService.cancelOrder(chargeId, payload);

    return {
      message: 'Estorno solicitado com sucesso.',
      data: result.data,
    };
  }

  /**
   * Webhook do PagBank para notificar status do pagamento pix
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK) // Sempre retorne 200 OK para o PagBank
  async handleWebhook(
    @Body() webhookData: any,
    @Headers('x-pagbank-signature') signature: string, // Pega o Header específico
    @Headers('x-pagbank-notification-id') notificationId: string, // Pega o ID da notificação
  ) {
    // Logs de entrada para debug
    console.log('📩 Webhook recebido:', { notificationId, signature });
    console.log('Dados do Webhook:', JSON.stringify(webhookData, null, 2));

    try {
      // Delega a lógica de processamento e segurança ao Service
      await this.pagSeguroService.handlePagBankWebhook(
        webhookData,
        signature,
        notificationId,
      );

      // Resposta de sucesso para o PagBank (código 200 OK é obrigatório)
      return { success: true, message: 'Webhook processado' };
    } catch (error) {
      console.error('❌ Erro no processamento do webhook:', error.message);
      // IMPORTANTE: Embora tenha ocorrido um erro interno,
      // geralmente é melhor retornar 200 OK para evitar que o
      // PagBank reenvie a notificação em loop.
      return { success: false, error: error.message };
    }
  }
  @Get('pix/status/:idPagamento')
  async checkStatus(@Param('idPagamento') idPagamento: string) {
    const pagamento = await this.prisma.pagamento.findFirst({
      where: { id_pagamento: idPagamento },
    });

    if (!pagamento) throw new NotFoundException();

    // Se no banco está PENDING, mas já passou do tempo de expiração real
    // (ex: 10 minutos após o created_at), podemos assumir expirado
    const limiteExpira = new Date(pagamento.created_at.getTime() + 60000); // 1 min
    if (pagamento.status === 'pending' && new Date() > limiteExpira) {
      return { status: 'expired' };
    }

    return { status: pagamento.status };
  }
}
