import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCardDto {
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
