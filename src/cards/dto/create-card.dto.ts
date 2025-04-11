import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCardDto {
  @IsNotEmpty()
  id_cliente: string; // publicado, em andamento, finalizado

  @IsNotEmpty()
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

  @IsNotEmpty()
  @IsString()
  categoria: string;

  @IsNotEmpty()
  @IsString()
  subcategoria: string;

  @IsNotEmpty()
  @IsString()
  valor: string;

  @IsNotEmpty()
  @IsString()
  horario_preferencial: string;

  @IsOptional()
  @IsString()
  codigo_confirmacao: string;

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
}
