import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  IsUUID,
} from 'class-validator';

export class CreatePixChargeDto {
  @IsString()
  reference_id: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  value: number; // Em reais, será convertido para centavos

  @IsOptional()
  @IsString()
  @IsUUID()
  id_pedido?: string; // ID do pedido no seu sistema

  @IsOptional()
  @IsNumber()
  @Min(1)
  expires_in_minutes?: number;

  @IsOptional()
  @IsArray()
  additional_info?: Array<{
    name: string;
    value: string;
  }>;
}
