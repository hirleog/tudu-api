import {
  IsString,
  IsObject,
  IsOptional,
  IsDateString,
  IsNumber,
} from 'class-validator';

class WebhookChargeAmountDto {
  @IsNumber()
  value: number;

  @IsString()
  currency: string;
}

class WebhookChargePaymentMethodDto {
  @IsString()
  type: string;
}

class WebhookChargeDto {
  @IsString()
  id: string;

  @IsString()
  reference_id: string;

  @IsString()
  status: string;

  @IsDateString()
  created_at: string;

  @IsOptional()
  @IsDateString()
  paid_at?: string;

  @IsObject()
  amount: WebhookChargeAmountDto;

  @IsObject()
  payment_method: WebhookChargePaymentMethodDto;
}

export class PagSeguroWebhookDto {
  @IsString()
  event: string;

  @IsObject()
  charge: WebhookChargeDto;
}
