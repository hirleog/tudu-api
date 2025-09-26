import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('credit')
  async payWithCreditCard(@Body() payload: any) {
    try {
      return await this.paymentsService.processCreditCardPayment(payload);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('cancelar/:id')
  async cancelarPagamento(
    @Param('id') id_pagamento: string,
    @Body() body: { amount?: number },
  ) {
    return this.paymentsService.cancelarPagamentoCompleto(
      id_pagamento,
      body.amount,
    );
  }

  // @Post('estornar/:id')
  // async estornarParcialmente(
  //   @Param('id') id_pagamento: string,
  //   @Body() body: { amount: number },
  // ) {
  //   return this.paymentsService.estornarParcialmente(id_pagamento, body.amount);
  // }

  @Get('status/:id')
  async consultarStatus(@Param('id') id_pagamento: string) {
    return this.paymentsService.consultarStatusPagamento(id_pagamento);
  }

  @Get('pedido/:id_pedido')
  async buscarPorPedido(@Param('id_pedido') id_pedido: string) {
    return this.paymentsService.buscarPagamentoPorPedido(id_pedido);
  }

  @Get('cliente/:id_cliente')
  async buscarPagamentosPorCliente(@Param('id_cliente') id_cliente: number) {
    const pagamentos =
      await this.paymentsService.buscarPagamentosPorCliente(id_cliente);

    return {
      success: true,
      data: pagamentos,
      total: pagamentos.length,
    };
  }

  @Get('cliente/:id_prestador/dashboard')
  async dashboardCliente(
    @Param('id_prestador') id_prestador: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const [pagamentosPaginados, estatisticas] = await Promise.all([
      this.paymentsService.buscarPagamentosPorClientePaginado(
        id_prestador,
        page,
        limit,
      ),
      this.paymentsService.estatisticasPagamentosCliente(id_prestador),
    ]);

    return {
      success: true,
      data: {
        pagamentos: pagamentosPaginados.pagamentos,
        estatisticas,
        paginacao: pagamentosPaginados.paginacao,
      },
    };
  }
  @Get('cliente/:id_prestador/estatisticas')
  async estatisticasCliente(@Param('id_prestador') id_prestador: number) {
    const estatisticas =
      await this.paymentsService.estatisticasPagamentosCliente(id_prestador);

    return {
      success: true,
      data: estatisticas,
    };
  }

  @Post('pedido/:id_pedido/cancelar')
  async cancelarPagamentoPorPedido(
    @Param('id_pedido') id_pedido: string,
    @Body() body: { amount?: number },
  ) {
    // 1. Primeiro buscar o pagamento no banco
    const pagamento = await this.prisma.pagamento.findFirst({
      where: { id_pedido },
    });

    if (!pagamento) {
      throw new NotFoundException('Pagamento não encontrado para este pedido');
    }

    // 2. Fazer o cancelamento usando o id_pagamento_getnet (não o id_pedido)
    return this.paymentsService.cancelarPagamentoCompleto(
      pagamento.id_pagamento, // ✅ Correto - ID da Getnet
      pagamento.total_amount,
    );
  }

  // @Post('pedido/:id_pedido/estornar')
  // async estornarPorPedido(
  //   @Param('id_pedido') id_pedido: string,
  //   @Body() body: { amount: number },
  // ) {
  //   // 1. Buscar o pagamento pelo id_pedido
  //   const pagamento = await this.prisma.pagamento.findFirst({
  //     where: { id_pedido },
  //   });

  //   if (!pagamento) {
  //     throw new NotFoundException('Pagamento não encontrado para este pedido');
  //   }

  //   // 2. Fazer o estorno usando o id_pagamento_getnet
  //   return this.pagamentoService.estornarParcialmente(
  //     pagamento.id_pagamento_getnet,
  //     body.amount,
  //   );
  // }

  // @Get(':id')
  // async buscarPagamento(@Param('id') id: number) {
  //   return this.prisma.pagamento.findUnique({
  //     where: { id },
  //   });
  // }
}
