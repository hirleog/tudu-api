// src/dto/send-message.dto.ts
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ButtonActionDto {
  @IsEnum(['CALL', 'URL', 'REPLAY'])
  type: 'CALL' | 'URL' | 'REPLAY';

  @IsString()
  buttonText: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  url?: string;
}

export class SendMessageDto {
  @IsString()
  phone: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  delayMessage?: number;
}

export class SendButtonActionsDto extends SendMessageDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ButtonActionDto)
  buttonActions: ButtonActionDto[];
}
