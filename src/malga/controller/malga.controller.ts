// src/malga/malga.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Query,
  Delete,
} from '@nestjs/common';

import {
  CreateTokenDto,
  CustomerCreationDto,
  ValidateTokenDto,
} from '../dto/tokenization.dto';
import {
  CreateChargeDto,
  CreatePaymentDto,
  UpdateChargeDto,
} from '../dto/create-create.dto';
import { MalgaService } from '../service/malga.service';
import { MalgaPaymentRequest } from '../entity/malga.entity';

@Controller('malga')
export class MalgaController {
  constructor(private readonly malgaService: MalgaService) {}

  // === TOKENIZATION ENDPOINTS ===
  @Post('tokens')
  async createToken(@Body() createTokenDto: any) {
    return this.malgaService.createToken(createTokenDto);
  }

  @Post('tokens/validate')
  async validateToken(@Body() validateTokenDto: ValidateTokenDto) {
    return this.malgaService.validateToken(validateTokenDto);
  }

  @Get('tokens/:id')
  async getToken(@Param('id') id: string) {
    return this.malgaService.getToken(id);
  }

  @Get('tokens')
  async listTokens(@Query('customerId') customerId: string) {
    return this.malgaService.listTokens(customerId);
  }

  @Delete('tokens/:id')
  async deleteToken(@Param('id') id: string) {
    return this.malgaService.deleteToken(id);
  }

  // === CUSTOMER ENDPOINTS ===
  @Post('customers')
  async createCustomer(@Body() customerData: CustomerCreationDto) {
    return this.malgaService.createCustomer(customerData);
  }

  @Get('customers/:id')
  async getCustomer(@Param('id') id: string) {
    return this.malgaService.getCustomer(id);
  }

  // === CHARGES ENDPOINTS ===
  @Post('charges')
  async createCharge(@Body() createChargeDto: CreateChargeDto) {
    return this.malgaService.createCharge(createChargeDto);
  }

  @Get('charges')
  async listCharges(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    return this.malgaService.listCharges({
      page,
      limit,
      startDate,
      endDate,
      status,
    });
  }

  @Get('charges/:id')
  async getCharge(@Param('id') id: string) {
    return this.malgaService.getCharge(id);
  }

  @Patch('charges/:id')
  async updateCharge(
    @Param('id') id: string,
    @Body() updateChargeDto: UpdateChargeDto,
  ) {
    return this.malgaService.updateCharge(id, updateChargeDto);
  }

  @Post('charges/:id/void')
  async cancelCharge(
    @Body() payload: { amount: string },
    @Param('id') chargeId: string,
  ) {
    return this.malgaService.cancelarCharge(payload, chargeId);
  }

  // === PAYMENTS ENDPOINTS ===
  @Post('payments')
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.malgaService.createPayment(createPaymentDto);
  }

  @Get('payments/:id')
  async getPayment(@Param('id') id: string) {
    return this.malgaService.getPayment(id);
  }

  @Post('payments/:id/capture')
  async capturePayment(
    @Param('id') id: string,
    @Body() body?: { amount?: number },
  ) {
    return this.malgaService.capturePayment(id, body?.amount);
  }

  @Post('payments/:id/cancel')
  async cancelPayment(
    @Param('id') id: string,
    @Body() body?: { amount?: number },
  ) {
    return this.malgaService.cancelPayment(id, body?.amount);
  }

  // === FLUXOS ESPECIAIS ===
  @Post('payments/token')
  async processPaymentWithToken(
    @Body()
    paymentData: {
      merchantId: string;
      amount: number;
      currency: string;
      orderId: string;
      customer: any;
      tokenId: string;
      securityCode: string;
      installments?: number;
      capture?: boolean;
    },
  ) {
    return this.malgaService.processPaymentWithToken(paymentData);
  }

  @Post('payments/tokenize-and-pay')
  async tokenizeAndPay(@Body() paymentData: MalgaPaymentRequest) {
    return this.malgaService.tokenizeAndPay(paymentData);
  }
}
