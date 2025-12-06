import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomerDto {
  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsString()
  tax_id: string;

  @IsArray()
  phones: Array<{
    country: string;
    area: string;
    number: string;
    type: string;
  }>;
}

class ItemDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(1)
  unit_amount: number;
}

class QrCodeDto {
  @IsObject()
  amount: {
    value: number;
  };

  @IsOptional()
  @IsString()
  expiration_date?: string;
}

export class CreatePixQrCodeDto {
  @IsString()
  reference_id: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer?: CustomerDto; // Opcional - será buscado do banco se não fornecido

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items?: ItemDto[]; // Opcional - será buscado do banco se não fornecido

  @IsOptional()
  @IsArray()
  qr_codes?: QrCodeDto[]; // Opcional - será gerado automaticamente

  @IsOptional()
  @IsArray()
  notification_urls?: string[];
}
