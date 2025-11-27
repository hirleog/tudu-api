import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Query,
  Patch,
  Param,
} from '@nestjs/common';
import { Response } from 'express';
import * as webpush from 'web-push';
import { NotificationsService } from '../service/notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService, // ← AQUI
  ) {
    webpush.setVapidDetails(
      'mailto:seu-email@dominio.com',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }

  @Post('subscribe')
  async subscribe(@Body() body: any) {
    console.log('📨 Dados recebidos no subscribe:', {
      clienteId: body.clienteId,
      prestadorId: body.prestadorId,
      clienteIdType: typeof body.clienteId,
      prestadorIdType: typeof body.prestadorId,
    });

    return this.notificationsService.saveSubscription(
      body.clienteId,
      body.prestadorId,
      body.subscription,
    );
  }

  @Post('test')
  async sendTest(@Res() res: Response) {
    const payload = {
      title: 'Test Push',
      body: 'Funcionou!',
      icon: '/assets/icons/icon-192x192.png',
      url: 'https://google.com',
    };

    // 1. Salva a notificação no banco
    const saved = await this.notificationsService.create(payload);

    // 2. Busca todas as inscrições de push
    const subscriptions = await this.notificationsService.getAllSubscriptions();

    // 3. Envia push para cada inscrito
    subscriptions.forEach((sub) => {
      webpush
        .sendNotification(sub.subscription, JSON.stringify(payload))
        .catch((err) =>
          console.error('Erro ao enviar push para assinatura: ', err),
        );
    });

    return res.json(saved);
  }

  @Get('list')
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('clienteId') clienteId?: number,
    @Query('prestadorId') prestadorId?: number,
    @Query('read') read?: boolean,
  ) {
    const options = {
      page: Math.max(1, page),
      limit: Math.min(50, Math.max(1, limit)), // Máximo 50 por página
      clienteId: clienteId ? Number(clienteId) : undefined,
      prestadorId: prestadorId ? Number(prestadorId) : undefined,
      read,
    };

    return this.notificationsService.findAll(options);
  }

  // ENDPOINT PARA MARCAR COMO LIDA
  @Patch('list/:id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(Number(id));
  }

  // ENDPOINT PARA MARCAR TODAS COMO LIDAS
  @Post('list/mark-all-read')
  async markAllAsRead(
    @Body() body: { clienteId?: number; prestadorId?: number },
  ) {
    return this.notificationsService.markAllAsRead(
      body.clienteId,
      body.prestadorId,
    );
  }

  // ENDPOINT PARA CONTAR NÃO LIDAS
  @Get('list/count/unread')
  async countUnread(
    @Query('clienteId') clienteId?: number,
    @Query('prestadorId') prestadorId?: number,
  ) {
    console.log('CountUnread - Parâmetros recebidos:', {
      clienteId,
      prestadorId,
    }); // DEBUG

    const count = await this.notificationsService.countUnread(
      clienteId ? Number(clienteId) : undefined,
      prestadorId ? Number(prestadorId) : undefined,
    );

    console.log('CountUnread - Resultado:', count); // DEBUG

    return { count };
  }
}
