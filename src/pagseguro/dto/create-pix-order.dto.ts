import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  IsObject,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

class AmountDto {
  @IsNumber()
  @Min(1)
  value: number;

  @IsString()
  currency: string = 'BRL';
}

class CustomerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  tax_id?: string;

  @IsOptional()
  @IsArray()
  phones?: Array<{
    country: string;
    area: string;
    number: string;
    type: string;
  }>;
}

class PixPaymentMethodDto {
  @IsString()
  type: string = 'pix';

  @IsOptional()
  @IsObject()
  pix?: {
    expires_in?: number;
    additional_information?: Array<{
      name: string;
      value: string;
    }>;
  };
}

class ItemDto {
  @IsString()
  reference_id: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(1)
  unit_amount: number;
}

export class CreatePixOrderDto {
  @IsString()
  reference_id: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];

  @IsOptional() // ← TORNAR OPCIONAL
  @IsArray()
  @IsString({ each: true })
  notification_urls?: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => PixPaymentMethodDto)
  payment_method: PixPaymentMethodDto;
}
