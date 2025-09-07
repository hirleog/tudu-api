import { Controller, Get, Req, Header } from '@nestjs/common';
import { Request } from 'express';

@Controller('api') // Define o prefixo da rota como 'api'
export class IpDeviceController {
  @Get('get-my-ip') // Rota completa: GET /api/get-my-ip
  @Header('Content-Type', 'application/json')
  getMyIp(@Req() request: Request): { ip: string } {
    // Obtém o IP real, considerando proxies e load balancers
    let clientIp = request.ip;

    console.log('Headers:', request.headers);
    console.log('IP detectado:', request.ip);

    // Fallbacks caso request.ip não esteja disponível
    if (!clientIp || clientIp === '::1') {
      clientIp = request.headers['x-forwarded-for'] as string;
    }

    if (!clientIp) {
      clientIp = request.connection?.remoteAddress;
    }

    if (!clientIp) {
      clientIp = request.socket?.remoteAddress;
    }

    // Caso 'x-forwarded-for' seja uma lista, pega o primeiro IP
    if (clientIp && typeof clientIp === 'string' && clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim();
    }

    // Limpa o IP (remove prefixos como ::ffff:)
    if (clientIp && clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7);
    }

    return { ip: clientIp || '127.0.0.1' };
  }
}
