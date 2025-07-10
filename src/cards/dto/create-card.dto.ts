import { Transform } from 'class-transformer';
import {
  IsArray,
  isDecimal,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCardDto {
  @IsOptional()
  @IsNumberString() // Aceita números como strings
  id_cliente?: any;

  @IsOptional()
  @IsNumberString() // Aceita números como strings
  id_prestador: string; // publicado, em andamento, finalizado

  @IsNotEmpty()
  @IsString()
  status_pedido: string; // publicado, em andamento, finalizado

  @IsOptional()
  @IsString()
  valor_negociado?: string;

  @IsOptional()
  @IsString()
  horario_negociado?: string;

  @IsOptional()
  @IsString()
  data_candidatura?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  codigo_confirmacao: string;

  @IsOptional()
  @IsString()
  data_finalização: string;

  @IsNotEmpty()
  @IsString()
  categoria: string;

  @IsNotEmpty()
  @IsString()
  subcategoria: string;

  @IsOptional()
  @IsString()
  serviceDescription?: string;

  @IsNotEmpty()
  @IsNumberString()
  @Transform(({ value }) => parseFloat(value).toFixed(2))
  valor: string;

  @IsNotEmpty()
  @IsString()
  horario_preferencial: string;

  @IsOptional()
  @IsArray()
  candidaturas?: any[]; // Array de candidaturas

  // Campos de endereço
  @IsNotEmpty()
  @IsString()
  cep: string;

  @IsNotEmpty()
  @IsString()
  street: string;

  @IsNotEmpty()
  @IsString()
  neighborhood: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsNotEmpty()
  @IsString()
  state: string;

  @IsNotEmpty()
  @IsString()
  number: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  imagens?: Express.Multer.File[];
}
