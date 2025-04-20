import {
  IsArray,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CandidaturaDto {
  @IsNumber()
  prestador_id: number; 
  
  @IsOptional()
  @IsString()
  valor_negociado?: string;

  @IsOptional()
  @IsString()
  horario_negociado?: string;

  @IsOptional()
  status?: string;
  
  @IsOptional()
  @IsString()
  data_finalizacao?: string;
}

export class UpdateCardDto {
  @IsOptional()
  @IsNumber()
  id_cliente?: number;

  @IsOptional()
  @IsNumber()
  id_prestador?: number;

  @IsOptional()
  @IsString()
  status_pedido?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  subcategoria?: string;

  @IsOptional()
  @IsString()
  valor?: string;

  @IsOptional()
  @IsString()
  horario_preferencial?: string;

  @IsOptional()
  @IsString()
  codigo_confirmacao?: string;

  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CandidaturaDto)
  candidaturas?: CandidaturaDto[];
}
