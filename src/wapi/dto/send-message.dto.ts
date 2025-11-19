// dto/send-message.dto.ts
import { IsString, IsNumber, IsOptional, Matches } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @Matches(/^\d+$/, { message: 'Phone must contain only numbers' })
  phone: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsNumber()
  delayMessage?: number;
}
