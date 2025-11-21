// w-api.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WApiService } from '../service/wapi.service';
import { ButtonActionDto, SendMessageDto } from '../dto/send-message.dto';
import { MessageResponseDto } from '../dto/message-response.dto';

@Controller('wapi')
export class WApiController {
  constructor(private readonly wApiService: WApiService) {}

  @Post('send-message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Body() sendMessageDto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.wApiService.sendMessage(sendMessageDto);
  }

  @Post('send-with-buttons')
  async sendWithButtons(
    @Body()
    body: {
      phone: string;
      message: string;
      buttonActions: ButtonActionDto[];
    },
  ) {
    const payload = {
      phone: body.phone,
      message: body.message,
      buttonActions: body.buttonActions,
    };
    await this.wApiService.sendButtonActions(payload);
    return { success: true, message: 'Notificação com botões enviada' };
  }
}
