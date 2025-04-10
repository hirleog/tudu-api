import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class CreateClienteDto {
  @IsNotEmpty()
  @IsString()
  telefone: string;

  @IsNotEmpty()
  @IsString()
  nome: string;

  @IsNotEmpty()
  @IsString()
  sobrenome: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  data_nascimento?: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsStrongPassword()
  password: string;

  @IsOptional()
  @IsString()
  endereco_estado?: string;

  @IsOptional()
  @IsString()
  endereco_cidade?: string;

  @IsOptional()
  @IsString()
  endereco_bairro?: string;

  @IsOptional()
  @IsString()
  endereco_rua?: string;

  @IsOptional()
  @IsString()
  endereco_numero?: string;
}
