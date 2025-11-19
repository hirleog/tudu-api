// w-api.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { SendMessageDto } from '../dto/send-message.dto';
import { MessageResponse } from '../interfaces/w-api.interface';

@Injectable()
export class WApiService {
  private readonly logger = new Logger(WApiService.name);
  private readonly baseUrl = 'https://api.w-api.app/v1';
  private readonly instanceId: string;
  private readonly token: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.instanceId = this.configService.get<string>('WAPI_INSTANCE_ID');
    this.token = this.configService.get<string>('WAPI_TOKEN');
  }

  async sendMessage(sendMessageDto: SendMessageDto): Promise<MessageResponse> {
    const { phone, message, delayMessage = 15 } = sendMessageDto;

    this.logger.log(`Enviando mensagem para: ${phone}`);

    try {
      const url = `${this.baseUrl}/message/send-text?instanceId=${this.instanceId}`;

      const response = await lastValueFrom(
        this.httpService.post<MessageResponse>(
          url,
          {
            phone: phone.replace(/\D/g, ''),
            message,
            delayMessage,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`,
            },
          },
        ),
      );

      this.logger.log(
        `Mensagem enviada com sucesso: ${response.data.messageId}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        'Erro ao enviar mensagem:',
        error.response?.data || error.message,
      );
      throw new Error(
        `Falha ao enviar mensagem: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}
