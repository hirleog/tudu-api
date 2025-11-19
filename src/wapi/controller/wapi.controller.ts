// w-api.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WApiService } from '../service/wapi.service';
import { SendMessageDto } from '../dto/send-message.dto';
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
}
