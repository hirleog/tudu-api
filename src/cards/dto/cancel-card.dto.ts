// src/cards/dto/cancel-card.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class CancelCardDto {
  @IsString()
  @IsOptional()
  cancellation_reason?: string;
}
